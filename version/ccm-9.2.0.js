/**
 * @overview <i>ccm</i> framework
 * @author André Kless <andre.kless@web.de> 2014-2017
 * @license The MIT License (MIT)
 * @version 9.2.0
 * @changes
 * version 9.2.0 (15.08.2017):
 * - improve ccm.component()
 * - dependent ccm instances must not use exactly the same ccm framework version as the root instance
 * version 9.1.0 (14.08.2017):
 * - add helper function 'append(parent,node)'
 * version 9.0.0 (29.07.2017):
 * - ccm.load supports resource data for each resource
 * - allow ccm.get dependency for key property of a ccm instance
 * - default website area of a ccm instance is a on-the-fly div element
 * - each ccm instance now knows it's root element
 * - light DOM is accessable via 'inner' property (not 'node')
 * - ccm.helper.dataset accepts data object or dataset directly
 * - bugfix for creating ccm instances without setting an element
 * - bugfix for cross-domain data exchanges via ccm.load
 * - stricter pads for allowed characters inside a component filename
 * - update caching mechanism for loading resources with ccm.load
 * - generated website area of a ccm instance is simply <div id='element'>
 * - add helper function 'transformStringArray(arr)'
 * - ccm.helper.protect accepts arrays and objects
 * - content that moves into DOM via helper functions is protected
 * - bugfix for realtime datastores
 * - bugfix for setting a deeper property via HTML attribute
 * - bugfix for calling ccm.helper.protect with a fragment
 * - add 'clear' property to ccm.helper.onfinish object
 * (for older version changes see ccm-8.1.0.js)
 */

( function () {

  /*---------------------------------------------- private ccm members -----------------------------------------------*/

  /**
   * @summary loaded <i>ccm</i> components
   * @memberOf ccm
   * @private
   * @type {Object.<ccm.types.index, ccm.types.component>}
   */
  var components = {};

  /**
   * @summary <i>ccm</i> database in IndexedDB
   * @memberOf ccm
   * @private
   * @type {object}
   */
  var db;

  /**
   * @summary already loaded resources
   * @memberOf ccm
   * @private
   * @type {object}
   */
  var resources = {};

  /**
   * @summary created <i>ccm</i> datastores
   * @memberOf ccm
   * @private
   * @type {Object.<ccm.types.source, ccm.Datastore>}
   */
  var stores = {};

  /**
   * @summary waitlist with actions that wait for currently loading resources
   * @memberOf ccm
   * @private
   * @type {Object.<string, ccm.types.action[]>}
   */
  var waiter = {};

  /*---------------------------------------------- private ccm classes -----------------------------------------------*/

  /**
   * @summary constructor for creating <i>ccm</i> datastores
   * @description See [this wiki page]{@link https://github.com/akless/ccm-developer/wiki/Data-Management} for general informations about <i>ccm</i> data management.
   * @memberOf ccm
   * @private
   * @class
   * @example
   * // Example for a <i>ccm</i> datastore instance:
   * {
   *   get: function ( key_or_query, callback ) {...},
   *   set: function ( priodata, callback ) {...},
   *   del: function ( key, callback ) {...},
   *   source: function () {...}
   * }
   */
  var Datastore = function () {

    /*-------------------------------------------- ccm datastore members ---------------------------------------------*/

    /**
     * @summary websocket communication callbacks
     * @private
     * @type {function[]}
     */
    var callbacks = [];

    var that = this;

    /**
     * @summary contains privatized members
     * @private
     * @type {object}
     */
    var my;

    /*----------------------------------------- public ccm datastore methods -----------------------------------------*/

    /**
     * @summary initialize datastore
     * @description
     * When datastore is created and after the initialization of an <i>ccm</i> instance in case of
     * this datastore is provided via a <i>ccm</i> dependency of that <i>ccm</i> instance.
     * This method will be removed by <i>ccm</i> after the one-time call.
     * @param {function} callback - when this datastore is initialized
     */
    this.init = function ( callback ) {

      // privatize security relevant members
      my = self.helper.privatize( that, 'source', 'local', 'store', 'url', 'db', 'socket', 'user' );

      // set getter method for ccm datastore source
      that.source = function () { return my.source; };

      // is realtime datastore? => set server notification callback
      if ( my.socket ) my.socket.onmessage = function ( message ) {

        // parse server message to JSON
        message = JSON.parse( message.data );

        // own request? => perform callback
        if ( message.callback ) callbacks[ message.callback - 1 ]( message.data );

        // notification about changed data from other client?
        else {

          // change data locally
          var dataset = self.helper.isObject( message ) ? updateLocal( message ) : delLocal( message );

          // perform change callback
          if ( that.onchange ) that.onchange( dataset );

        }

      };

      // perform callback
      if ( callback ) callback();

    };

    /**
     * @summary get one or more stored datasets
     * @description
     * There are two ways to use this method depending on the first parameter.
     * The first way is to get a single dataset with a given key.
     * The second way is to get all datasets that matches a given query.
     * With no first parameter the method provides an array with all stored datasets.
     * In this case the callback could be the first parameter directly.
     * Getting all stored datasets counts as a query and don't work if the chosen data level not supports queries.
     * If a query is used and data is managed via server-side database (data level 3), than the resulting datasets never come from local cache..
     * See [table of supported operations]{@link https://github.com/akless/ccm-developer/wiki/Data-Management#supported-operations} to check this.
     * If the wanted data is completely local cached via <i>ccm</i> and is not containing data dependencies to external sources, than the data could be received as return value.
     * Data dependencies inside the requested data will be automatically resolved via <i>ccm</i> (see last example).
     * For more informations about [data dependencies]{@link ccm.get} see the given link.
     * @param {ccm.types.key|object} [key_or_query] - unique key of the dataset or alternative a query
     * @param {ccm.types.getResult} [callback] - when data operation is finished
     * @returns {ccm.types.dataset|ccm.types.dataset[]} requested dataset(s) (only if no inner operation is asynchron)
     * @example
     * // get array of all stored datasets
     * store.get( function ( result ) {
     *   console.log( result );                  // [ { key: ..., ... }, ... ]
     * } );
     * @example
     * // get single dataset with unique key 'test'
     * store.get( 'test', function ( result ) {
     *   console.log( result );                  // { key: 'test', ... }
     * } );
     * @example
     * // get single dataset with unique key 4711
     * store.get( 4711, function ( result ) {
     *   console.log( result );                  // { key: 4711, ... }
     * } );
     * @example
     * // get array of all stored datasets that match the given query
     * store.get( {
     *   author: 'akless',        // This query selects all datasets that have a property 'author'
     *   year: 2015               // with value 'akless' and a property 'year' with value '2015'.
     * }, function ( result ) {
     *   console.log( result );   // [ { key: ..., author: 'akless', year: 2015, ... }, ... ]
     * } );
     * @example
     * // get array of all stored datasets as return value (only if no inner operation is asynchron)
     * var result = store.get();
     * console.log( result );
     * @example
     * // get single dataset that contains a data dependency
     * store.set( {                                                   // Store a dataset
     *   key:   'test',                                               // that contains a
     *   other: [ 'ccm.get', { url: ..., store: ... }, 'test2' ]  // data dependency
     * } );                                                           // and than request it.
     * var result = store.get( 'test' );
     * console.log( result );             // { key: 'test', other: { key: 'test2', ... } }
     */
    this.get = function ( key_or_query, callback ) {

      // allow skipping of first parameter
      if ( typeof key_or_query === 'function' ) { callback = key_or_query; key_or_query = undefined; }

      // dataset key is undefined? => use empty object (to select all datasets as default)
      if ( key_or_query === undefined ) key_or_query = {};

      // check data source
      if ( my.url   ) return serverDB();    // server-side database
      if ( my.store ) return clientDB();    // client-side database
      if ( my.local ) return localCache();  // local cache

      /**
       * get dataset(s) from local cache
       * @returns {ccm.types.dataset}
       */
      function localCache() {

        return getLocal( key_or_query, callback );

      }

      /**
       * get dataset(s) from client-side database
       */
      function clientDB() {

        /**
         * local cached dataset
         * @type {ccm.types.dataset}
         */
        var dataset = checkLocal();

        // is dataset local cached? => return local cached dataset
        if ( dataset ) return dataset;

        /**
         * object store from IndexedDB
         * @type {object}
         */
        var store = getStore();

        /**
         * request for getting dataset
         * @type {object}
         */
        var request = store.get( key_or_query );

        // set success callback
        request.onsuccess = function ( evt ) {

          // no callback? => abort
          if ( !callback ) return;

          /**
           * result dataset
           * @type {ccm.types.dataset}
           */
          var dataset = evt.target.result;

          // result is not a ccm dataset? => perform callback with null
          if ( !self.helper.isDataset( dataset ) ) callback( null );

          // set result dataset in local cache
          setLocal( dataset );

          // perform callback with result dataset
          if ( callback ) callback( dataset || null );

        };

      }

      /**
       * get dataset(s) from server-side database
       */
      function serverDB() {

        // get dataset by key?
        if ( !self.helper.isObject( key_or_query ) ) {

          /**
           * local cached dataset
           * @type {ccm.types.dataset}
           */
          var dataset = checkLocal();

          // is dataset local cached? => return local cached dataset
          if ( dataset ) return dataset;

        }

        /**
         * GET parameter
         * @type {object}
         */
        var data = prepareData( { key: key_or_query } );

        // load dataset from server interface
        if ( my.socket ) useWebsocket( data, onResponse ); else useHttp( data, onResponse );

        /**
         * callback for server response
         * @param {*} response
         */
        function onResponse( response ) {

          // set result dataset(s) in local cache
          if ( self.helper.isDataset( response ) )
            setLocal( response );
          else if ( Array.isArray( response ) )
            response.map( setLocal );

          // perform callback with server response
          if ( callback ) callback( response || null );

        }

      }

      /**
       * check if dataset is local cached
       * @returns {ccm.types.dataset}
       */
      function checkLocal() {

        /**
         * local cached dataset
         * @type {ccm.types.dataset}
         */
        var dataset = getLocal( key_or_query );

        // is dataset local cached? => perform callback with local cached dataset
        if ( dataset && callback ) callback( dataset );

        // return local cached dataset
        return dataset;

      }

    };

    /**
     * @summary create or update a dataset
     * @description
     * If the given priority data has no key property, than the priority data will be set as a new dataset with a generated key.
     * If the given priority data contains a value for the key property and a dataset with that given key already exists in the datastore, than that dataset will be updated with the given priority data.
     * If no dataset with that given key exists, than the priority data will be set as a new dataset with the given key.
     * For more informations about [priority data]{@link ccm.helper.integrate} or [automatic generation of unique keys]{@link ccm.helper.generateKey} see the given links.
     * Partial updates of deeper properties with dot notation (see last example) don't works if the chosen data level not supports deep partial updates.
     * See [table of supported operations]{@link https://github.com/akless/ccm-developer/wiki/Data-Management#supported-operations} to check this.
     * The resulting created or updated dataset will be provided via callback.
     * If the dataset is only managed via local cache, than the results could be received via return value.
     * If priodata contains a not valid ccm dataset key, than the result is <code>null</code>.
     * @param {ccm.types.dataset} priodata - priority data
     * @param {ccm.types.setResult} [callback] - when data operation is finished
     * @returns {ccm.types.dataset} created or updated dataset (only if no inner operation is asynchron)
     * @example
     * // store a new dataset with a automatic generated unique key
     * store.set( {
     *   question: 'my question',           // The priority data don't
     *   answers: [ 'answer1', 'answer2' ]  // contains a property 'key'.
     * }, function ( result ) {
     *   console.log( result );   // { key: 1465718723761X7117581531745409, question: ..., answers: ... }
     * } );
     * @example
     * // create a new dataset with unique key 'test'
     * store.set( {
     *   key: 'test',             // Creates a new dataset if a dataset with unique key 'test' already exists
     *   value: 'foo'             // in the datastore. Otherwise the existing dataset will be updated.
     * }, function ( result ) {
     *   console.log( result );   // { key: 'test', value: 'foo' } or { key: 'test', value: 'foo', ... }
     * } );
     * @example
     * // get result as return value (only if no inner operation is asynchron)
     * var result = store.set( { key: 'test', value: 'foo' } );
     * console.log( result );
     * @example
     * // updates a deeper property of a stored dataset
     * store.set( {
     *   key: 'test',
     *   'feedback.user.comment': 'My comment'
     * }, function ( result ) {
     *   console.log( result );   // { key: 'test', feedback: { user: { comment: 'My comment', ... }, ... }, ... }
     * } );
     */
    this.set = function ( priodata, callback ) {

      // clone priority data
      priodata = self.helper.clone( priodata );

      // priority data has no key? => generate unique key
      if ( !priodata.key ) priodata.key = self.helper.generateKey();

      // priority data does not contains a valid ccm dataset key? => abort and perform callback without a result
      if ( Array.isArray( priodata.key ) ) {
        for ( var i = 0; i < priodata.key.length; i++ )
          if ( !self.helper.regex( 'key' ).test( priodata.key[ i ] ) ) {
            if ( callback ) callback( null );
            return null;
          }
      }
      else if ( !self.helper.regex( 'key' ).test( priodata.key ) ) {
        if ( callback ) callback( null );
        return null;
      }

      // choose data level
      if ( my.url   ) return serverDB();    // server-side database
      if ( my.store ) return clientDB();    // client-side database
      if ( my.local ) return localCache();  // local cache

      /**
       * set dataset in local cache
       * @returns {ccm.types.dataset} created or updated dataset
       */
      function localCache() {

        return updateLocal( priodata, callback );

      }

      /**
       * set dataset in client-side database
       * @returns {ccm.types.dataset} created or updated dataset
       */
      function clientDB() {

        /**
         * object store from IndexedDB
         * @type {object}
         */
        var store = getStore();

        /**
         * request for setting dataset
         * @type {object}
         */
        var request = store.put( priodata );

        // set success callback
        request.onsuccess = localCache;

      }

      /**
       * set dataset in server-side database
       * @returns {ccm.types.dataset} created or updated dataset
       */
      function serverDB() {

        /**
         * GET parameter
         * @type {object}
         */
        var data = prepareData( { dataset: priodata } );

        // send priority data to server interface
        if ( my.socket ) useWebsocket( data, onResponse ); else useHttp( data, onResponse );

        /**
         * callback for server response
         * @param {ccm.types.dataset} dataset - created or updated dataset
         */
        function onResponse( dataset ) {

          // check server response
          if ( !checkResponse( dataset ) ) return;

          // set dataset in local cache
          priodata = dataset; localCache();

        }

      }

    };

    /**
     * @summary delete a stored dataset
     * @param {ccm.types.key} key - unique key of the dataset
     * @param {ccm.types.delResult} [callback] - when data operation is finished
     * @returns {ccm.types.dataset} deleted dataset (only if no inner operation is asynchron)
     * @example
     * // delete dataset with unique key 'test'
     * store.del( 'test', function ( result ) {
     *   console.log( result );                  // { key: 'test', ... }
     * } );
     * @example
     * // delete dataset with unique key 4711
     * store.del( 4711, function ( result ) {
     *   console.log( result );                  // { key: 4711, ... }
     * } );
     * @example
     * // get result as return value (only if no inner operation is asynchron)
     * var result = store.del( 'test' );
     * console.log( result );
     */
    this.del = function ( key, callback ) {

      // check data source
      if ( my.url   ) return serverDB();    // server-side database
      if ( my.store ) return clientDB();    // client-side database
      if ( my.local ) return localCache();  // local cache

      /**
       * delete dataset in local cache
       * @returns {ccm.types.dataset} deleted dataset
       */
      function localCache() {

        return delLocal( key, callback );

      }

      /**
       * delete dataset in client-side database
       */
      function clientDB() {

        /**
         * object store from IndexedDB
         * @type {object}
         */
        var store = getStore();

        /**
         * request for deleting dataset
         * @type {object}
         */
        var request = store.delete( key );

        // set success callback
        request.onsuccess = localCache;

      }

      /**
       * delete dataset in server-side database
       */
      function serverDB() {

        /**
         * GET parameter
         * @type {object}
         */
        var data = prepareData( { del: key } );

        // send dataset key to server interface
        if ( my.socket ) useWebsocket( data, onResponse ); else useHttp( data, onResponse );

        /**
         * callback for server response
         * @param {ccm.types.dataset} dataset - deleted dataset
         */
        function onResponse( dataset ) {

          // check server response
          if ( !checkResponse( dataset ) ) return;

          // perform callback with deleted dataset
          if ( callback ) callback( dataset );

          // delete dataset in local cache
          callback = undefined; localCache();

        }

      }

    };

    /*---------------------------------------- private ccm datastore methods -----------------------------------------*/

    /**
     * @summary get dataset(s) from local cache
     * @private
     * @param {ccm.types.key|object} [key={}] - dataset key or query (default: all stored datasets)
     * @param {function} [callback] - callback (first parameter is result dataset)
     * @returns {ccm.types.dataset} result dataset (only if synchron)
     */
    function getLocal( key, callback ) {

      // dataset key is a query? => find dataset(s) by query
      if ( key === undefined || self.helper.isObject( key ) ) return find();

      /**
       * result dataset
       * @type {ccm.types.dataset}
       */
      var dataset = self.helper.clone( my.local[ key ] ) || null;

      // solve data dependencies
      solveDependencies( dataset, callback );

      // return result dataset (only synchron)
      return dataset;

      /**
       * @summary find dataset(s) by query
       * @returns {ccm.types.dataset[]} dataset(s)
       */
      function find() {

        /**
         * result dataset(s)
         * @type {ccm.types.dataset[]}
         */
        var results = [];

        /**
         * number of founded processing datasets
         * @type {number}
         */
        var counter = 1;

        // iterate over all stored datasets
        for ( var i in my.local ) {

          // query is subset of dataset?
          if ( self.helper.isSubset( key, my.local[ i ] ) ) {

            /**
             * founded dataset
             * @type {ccm.types.dataset}
             */
            var dataset = self.helper.clone( my.local[ i ] );

            // add founded dataset to result datasets
            results.push( dataset );

            // increment number of founded processing datasets
            counter++;

            // solve founded dataset data dependencies
            solveDependencies( dataset, check );

          }

        }

        // checks if processing of all founded datasets is finished (happens when no data dependencies exists)
        check();

        // return result dataset(s)
        return results;

        /**
         * checks if processing of all founded datasets is finished
         */
        function check() {

          // decrement number of founded processing datasets
          counter--;

          // finished processing of all founded datasets? => perform callback
          if ( counter === 0 && callback) callback( results );

        }

      }

      /**
       * solve ccm data dependencies for ccm dataset
       * @param {ccm.types.dataset} dataset - ccm dataset
       * @param {function} [callback] - callback
       */
      function solveDependencies( dataset, callback ) {

        /**
         * number of loading datasets
         * @type {number}
         */
        var counter = 1;

        /**
         * waitlist for ccm data dependencies which must be solved but wait for loading ccm datastore
         * @type {Array}
         */
        var waiter = [];

        // search dataset for dependencies
        search( dataset );

        // check if all data dependencies are solved (happens when no data dependencies exists)
        check();

        /**
         * search array or object for dependencies (recursive)
         * @param {Array|Object} array_or_object
         */
        function search( array_or_object ) {

          // iterate over dataset properties
          for ( var key in array_or_object ) {

            /**
             * property value
             * @type {*}
             */
            var value = array_or_object[ key ];

            // value is a ccm dependency? => solve dependency
            if ( self.helper.isDependency( value ) && value[ 0 ] === 'ccm.get' ) solveDependency( array_or_object, key ) ;

            // value is an array? => search array elements for data dependencies
            else if ( Array.isArray( value ) || self.helper.isObject( value ) ) search( value );  // recursive call

          }

        }

        /**
         * solve data dependency
         * @param {ccm.types.dataset} dataset - dataset or array
         * @param {ccm.types.key} key - key or array index
         */
        function solveDependency( dataset, key ) {

          // needed ccm datastore is loading => add data dependency to waitlist
          if ( stores[ getSource( dataset[ key ][ 1 ] ) ] === null )
            return waiter.push( [ solveDependency, dataset, key ] );

          // increase number of loading datasets
          counter++;

          // solve data dependency
          self.helper.solveDependency( dataset, key, check );

        }

        /**
         * check if all data dependencies are solved
         */
        function check() {

          // decrease number of loading datasets
          counter--;

          // are not all data dependencies solved? => abort
          if ( counter !== 0 ) return;

          // waitlist not empty? => abort and solve a data dependency in waitlist
          if ( waiter.length > 0 ) return self.helper.action( waiter.pop() );

          // perform callback with result dataset
          if ( callback ) callback( dataset );

        }

      }

    }

    /**
     * @summary set dataset in local cache
     * @private
     * @param {ccm.types.dataset} dataset
     */
    function setLocal( dataset ) {

      if ( dataset.key ) my.local[ dataset.key ] = dataset;

    }

    /**
     * @summary update dataset in local cache
     * @private
     * @param {ccm.types.dataset} priodata - priority data
     * @param {function} [callback] - callback (first parameter is created or updated dataset)
     * @returns {ccm.types.dataset} created or updated dataset
     */
    function updateLocal( priodata, callback ) {

      // is dataset local cached? => update local dataset
      if ( my.local[ priodata.key ] )
        self.helper.integrate( priodata, my.local[ priodata.key ] );

      // dataset not local cached => cache dataset locally
      else my.local[ priodata.key ] = priodata;

      // return local cached dataset
      return getLocal( priodata.key, callback );

    }

    /**
     * @summary delete dataset in local cache
     * @private
     * @param {ccm.types.key} [key] - dataset key (default: delete complete local cache)
     * @param {function} [callback] - callback  (first parameter is deleted dataset)
     * @returns {ccm.types.dataset} deleted dataset
     */
    function delLocal( key, callback ) {

      /**
       * local cached dataset
       * @type {ccm.types.dataset}
       */
      var dataset;

      // no dataset key?
      if ( key === undefined ) {

        // get and clear local cache
        dataset = my.local;
        my.local = {};

      }

      // has dataset key
      else {

        // get and delete dataset
        dataset = my.local[ key ];
        delete my.local[ key ];

      }

      // perform callback with deleted dataset
      if ( callback ) callback( dataset );

      // return deleted dataset
      return dataset;

    }

    /**
     * @summary get object store from IndexedDB
     * @private
     * @returns {object}
     */
    function getStore() {

      /**
       * IndexedDB transaction
       * @type {object}
       */
      var trans = db.transaction( [ my.store ], 'readwrite' );

      // return object store from IndexedDB
      return trans.objectStore( my.store );

    }

    /**
     * @summary prepare GET parameter data
     * @private
     * @param data - individual GET parameters
     * @returns {object} complete GET parameter data
     */
    function prepareData( data ) {

      data = self.helper.integrate( data, { db: my.db, store: my.store } );
      if ( !my.db ) delete data.db;
      if ( my.user && my.user.isLoggedIn() )
        data = self.helper.integrate( data, { user: my.user.data().key, token: my.user.data().token } );
      return data;

    }

    /**
     * @summary send data to server interface via websocket connection
     * @private
     * @param {object} data - GET parameter data
     * @param {function} callback - callback for server response
     */
    function useWebsocket( data, callback ) {

      callbacks.push( callback );
      data.callback = callbacks.length;
      my.socket.send( JSON.stringify( data ) );

    }

    /**
     * @summary send data to server interface via http request
     * @private
     * @param {object} data - GET parameter data
     * @param {function} callback - callback for server response
     */
    function useHttp( data, callback ) {

      self.load( [ my.url, data ], callback );

    }

    /**
     * @summary checks server response
     * @private
     * @param {*} [response] - server response
     * @returns {boolean}
     */
    function checkResponse( response ) {

      // server response is error message?
      if ( typeof response === 'string' ) {

        // abort processing
        return false;

      }

      // continue processing
      return true;

    }

  };

  /*--------------------------------------------- public ccm namespaces ----------------------------------------------*/

  // set global ccm namespace
  if ( !window.ccm ) ccm = {

    /**
     * @summary global namespaces for <i>ccm</i> components
     * @memberOf ccm
     * @type {Object.<ccm.types.index, object>}
     */
    components: {},

    /**
     * @summary callbacks for cross domain data exchanges
     * @memberOf ccm
     * @type {Object.<string, function>}
     * @ignore
     */
    callbacks: {},

    /**
     * @summary deposited data from loaded javascript files
     * @memberOf ccm
     * @type {object}
     * @ignore
     */
    files: {}

  };

  /**
   * global <i>ccm</i> object of this framework version
   * @type {object}
   */
  var self = {

    /*---------------------------------------------- public ccm methods ----------------------------------------------*/

    /**
     * @summary returns <i>ccm</i> version number
     * @memberOf ccm
     * @return {ccm.types.version}
     */
    version: function () { return '9.2.0'; },

    /**
     * @summary reset caches for resources and datastores
     * @memberOf ccm
     */
    clear: function () {
      resources = {};
      stores = {};
    },

    /**
     * @summary load resource(s) (js, css, json and/or data from server interface)
     * @memberOf ccm
     * @param {...object|string} resources - resource(s) data (contains data how to load resource) and/or URLs
     * @param {function} [callback] - callback when all resources are loaded (first parameter are the results)
     * @returns {*} results (only if all resources already loaded)
     * @example
     * // load ccm component with callback (local path)
     * ccm.load( 'ccm.chat.js', function ( component ) {...} );
     * @example
     * // load ccm component without callback (cross domain)
     * ccm.load( 'http://akless.github.io/ccm-developer/resources/ccm.chat.min.js' );
     * @example
     * // load javascript file (local path)
     * ccm.load( 'scripts/helper.js' );
     * @example
     * // load jQuery UI (cross domain)
     * ccm.load( 'https://code.jquery.com/ui/1.11.4/jquery-ui.min.js' );
     * @example
     * // load css file (local path)
     * ccm.load( 'css/style.css' );
     * @example
     * // load image file (cross domain)
     * ccm.load( 'http://www.fh-lsoopjava.de/ccm/img/dialogbox.png' );
     * @example
     * // load json file with callback (local path)
     * ccm.load( 'json/data.json', function ( data ) { console.log( data ); } );
     * @example
     * // load json file with callback (cross domain), json file must look like this: ccm.callback[ 'ccm.chat.templates.min.json' ]( {...} );
     * ccm.load( 'http://akless.github.io/ccm-developer/resources/ccm.chat.templates.min.json', function ( data ) {...} );
     * @example
     * // data exchange between client and server php interface with callback (cross domain), php file must use jsonp
     * ccm.load( [ 'http://www.fh-lsoopjava.de/ccm/php/greetings.php', { name: 'world' } ], function ( response ) { console.log( response ); } );
     */
    load: function () {

      /**
       * number of loading resources
       * @type {number}
       */
      var counter = 1;

      /**
       * result data of this ccm.load call
       * @type {*}
       */
      var results = [];

      /**
       * convert arguments to real array
       * @type {Array}
       */
      var args = self.helper.makeIterable( arguments );

      /**
       * current ccm.load call
       * @type {ccm.types.action}
       */
      var call = args.slice( 0 ); call.unshift( self.load );

      /**
       * is this ccm.load call already waiting for currently loading resource(s)?
       * @type {boolean}
       */
      var waiting = false;

      /**
       * callback when all resources are loaded
       * @type {function}
       */
      var callback;

      // last argument is callback? => separate arguments and callback
      if ( typeof args[ args.length - 1 ] === 'function' ) callback = args.pop();

      // iterate over resources data => load resource
      args.map( loadResource );

      // check if all resources are loaded (important if all resources already loaded)
      return check();

      /**
       * load resource
       * @param {object|string} resource - resource data or URL
       * @param {string} resource.url - resource URL
       * @param {object} [resource.params] - HTTP GET parameters (in case of data exchange)
       * @param {Element} [resource.context=document.head] - resource will loaded in this context
       * @param {boolean} [resource.ignore_cache] - ignore already cached result for this resource
       * @param {string} [resource.username] - username for HTTP request
       * @param {string} [resource.password] - password for HTTP request
       * @param {number} i
       */
      function loadResource( resource, i ) {

        // increase number of loading resources
        counter++;

        // resource data is an array? => load resources serial
        if ( Array.isArray( resource ) ) { results[ i ] = []; return serial( null ); }

        // has URL instead of resource data? => use resource data which contains only the URL information
        if ( !self.helper.isObject( resource ) ) resource = { url: resource };

        // resource has to be load in a specific context? => ignore cache (to support loading of same resource in different contexts)
        if ( resource.context ) resource.ignore_cache = true;

        // no caching for data exchanges with server interfaces
        if ( resource.params ) resource.ignore_cache = true;

        // no context? => load resource in global <head> context (no Shadow DOM)
        if ( !resource.context || resource.context === 'head' ) resource.context = document.head;

        // prevent loading resource twice
        if ( caching() ) return;

        // mark resource as 'loading'
        resources[ resource.url ] = null;

        // GET parameter exists? => perform data exchange
        if ( resource.params ) return exchangeData();

        /**
         * resource suffix
         * @type {string}
         */
        var suffix = resource.url.split( '.' ).pop();

        // check resource suffix => load resource
        switch ( suffix ) {
          case 'html':
            return loadHTML();
          case 'css':
            return loadCSS();
          case 'jpg':
          case 'gif':
          case 'png':
          case 'svg':
            return loadImage();
          case 'js':
            return loadJS();
          case 'json':
            return loadJSON();
          default:
            exchangeData();
        }

        /**
         * load resources serial (recursive function)
         * @param {*} result - result of the last serial loaded resource (is null on first call)
         */
        function serial( result ) {

          // not first call? => save result
          if ( result !== null ) results[ i ].push( result );

          // more resources to load serial?
          if ( resource.length > 0 ) {

            /**
             * next resource that must load serial
             * @type {*}
             */
            var next = resource.shift();

            // next resource is array of resources? => load resources in parallel (recursive call)
            if ( Array.isArray( next ) ) { next.push( serial ); self.load.apply( null, next ); }

            // one resource => load next resource serial (recursive call)
            else self.load( next, serial );

          }

          // serial loading finished => check if all resources are loaded
          else check();

        }

        /**
         * prevents loading a resource twice
         * @returns {boolean} abort current ccm.load call
         */
        function caching() {

          // no caching for this resource? => continue current ccm.load call
          if ( resource.ignore_cache ) return false;

          // is resource currently loading?
          if ( resources[ resource.url ] === null ) {

            // is this ccm.load call already waiting? => abort current ccm.load call (counter will not decrement)
            if ( waiting ) return true;

            // mark current ccm.load call as waiting
            waiting = true;

            // no waitlist for currently loading resource exists? => create waitlist
            if ( !waiter[ resource.url ] ) waiter[ resource.url ] = [];

            // add ccm.load call to waitlist
            waiter[ resource.url ].push( call );

            // abort current ccm.load call (counter will not decrement)
            return true;

          }

          // resource already loaded?
          if ( resources[ resource.url ] !== undefined ) {

            // result is already loaded resource value
            results[ i ] = resources[ resource.url ];

            // skip loading process
            success(); return true;

          }

          // continue current ccm.load call
          return false;

        }

        /** loads the content of a HTML file */
        function loadHTML() {

          // load content via AJAX request
          ajax( { url: resource.url, type: 'html', callback: successData } );

        }

        /** loads (and executes) a CSS file */
        function loadCSS() {

          // load css file via <link>
          var tag = self.helper.html( { tag: 'link', rel: 'stylesheet', type: 'text/css', href: resource.url } );
          resource.context.appendChild( tag );
          tag.onload = success;

        }

        /** (pre)loads an image file */
        function loadImage() {

          // load image via image object
          var image = new Image();
          image.src = resource.url;
          image.onload = success;

        }

        /** loads (and executes) a javascript file */
        function loadJS() {

          // load javascript file via <script>
          var tag = self.helper.html( { tag: 'script', src: resource.url } );
          resource.context.appendChild( tag );
          tag.onload = function () {

            // add deposited data of the loaded javascript file to results and already loaded resources
            var filename = resource.url.split( '/' ).pop();
            results[ i ] = resources[ resource.url ] = ccm.files[ filename ];
            delete ccm.files[ filename ];

            success();
          };

        }

        /** loads the content of a JSON file */
        function loadJSON() {

          // load content via AJAX request
          ajax( { url: resource.url, type: 'json', callback: function ( result ) { successData( JSON.parse( result ) ); } } );

        }

        /** exchanges data with a server interface */
        function exchangeData() {

          // is this ccm.load call already waiting for currently loading resource(s)? => skip data exchange for the moment
          if ( waiting ) return;

          // cross-domain request? => use JSONP
          if ( resource.url.indexOf( 'http' ) === 0 ) return jsonp();

          // prepare AJAX settings
          var settings = { url: resource.url, data: resource.params, callback: successData };
          if ( resource.username && resource.password ) {
            if ( resource.username ) settings.username = resource.username;
            if ( resource.password ) settings.password = resource.password;
          }

          // exchange data with server via AJAX request
          ajax( settings );

          /** exchange data with server via JSONP */
          function jsonp() {

            // prepare callback function
            var callback = 'callback' + self.helper.generateKey();
            if ( !resource.params ) resource.params = {};
            resource.params.callback = 'ccm.callbacks.' + callback;
            ccm.callbacks[ callback ] = function ( data ) {
              resource.context.removeChild( tag );
              delete ccm.callbacks[ callback ];
              successData( data );
            };

            // exchange data via <script>
            var tag = self.helper.html( { tag: 'script', src: buildURL( resource.url, resource.params ) } );
            tag.src = tag.src.replace( /&amp;/g, '&' );
            resource.context.appendChild( tag );

          }

        }

        /**
         * sends an AJAX request
         * @param {object} settings - settings for AJAX request
         */
        function ajax( settings ) {

          switch ( settings.type ) {
            case 'html':
              settings.type = 'text/html';
              break;
            case 'json':
              settings.type = 'application/javascript';
              break;
          }
          settings.async = settings.async === undefined ? true : !!settings.async;

          var request = new XMLHttpRequest();
          request.open( 'GET', buildURL( settings.url, settings.data ), !!settings.async, settings.username, settings.password );
          if ( settings.type ) request.setRequestHeader( 'Content-type', settings.type );
          //request.setRequestHeader( 'Authorization', 'Basic ' + btoa( settings.username + ':' + settings.password ) );
          request.onreadystatechange = function () {
            if( request.readyState == 4 && request.status == 200 )
              settings.callback( request.responseText );
          };
          request.send();

        }

        function buildURL( url, data ) {

          return data ? url + '?' + params( data ).slice( 0, -1 ) : url;

          function params( obj, prefix ) {
            var result = '';
            for ( var i in obj ) {
              var key = prefix ? prefix + '[' + encodeURIComponent( i ) + ']' : encodeURIComponent( i );
              if ( typeof( obj[ i ] ) === 'object' )
                result += params( obj[ i ], key );
              else
                result += key + '=' + encodeURIComponent( obj[ i ] ) + '&';
            }
            return result;

          }

        }

        /**
         * callback when a data exchange is successful
         * @param {*} data - received data
         */
        function successData( data ) {

          // add received data to results and already loaded resources
          results[ i ] = resources[ resource.url ] = data;

          // perform success callback
          success();

        }

        /** callback when a resource is successful loaded */
        function success() {

          // add url to results and already loaded resources
          if ( results[ i ] === undefined ) results[ i ] = resources[ resource.url ] = resource.url;

          // is resource on waitlist? => perform waiting actions
          while ( waiter[ resource.url ] && waiter[ resource.url ].length > 0 )
            self.helper.action( waiter[ resource.url ].pop() );

          // check if all resources are loaded
          check();

        }

      }

      /**
       * check if all resources are loaded
       * @returns {*} results (only if all resources already loaded)
       */
      function check() {

        // decrease number of loading resources
        counter--;

        // are all resources loaded?
        if ( counter === 0 ) {

          // only one result? => use no array
          if ( results.length <= 1 ) results = results[ 0 ];

          // finish ccm.load call
          if ( callback ) callback( results );
          return results;

        }

      }

    },

    /**
     * @summary registers a <i>ccm</i> component in the <i>ccm</i> framework
     * @memberOf ccm
     * @param {ccm.types.component|ccm.types.url|ccm.types.index} component - object, URL or index of a <i>ccm</i> component
     * @param {ccm.types.config} [config] - default <i>ccm</i> instance configuration (check documentation of associated <i>ccm</i> component to see which properties could be set)
     * @param {function} [callback] - callback when <i>ccm</i> component is registered (first parameter is the object of the registered <i>ccm</i> component)
     * @returns {ccm.types.component} object of the registered <i>ccm</i> component (only if synchron)
     * @example ccm.component( { index: 'chat-2.1.3', Instance: function () { ... } } );
     * @example ccm.component( { name: 'chat', version: [2,1,3], Instance: function () {...} } );
     * @example ccm.component( { name: 'blank', Instance: function () {...} } );
     * @example ccm.component( 'ccm.blank.js );
     * @example ccm.component( 'http://akless.github.io/ccm-developer/resources/ccm.chat.min.js' );
     */
    component: function ( component, config, callback ) {

      // config parameter is a function? => config skipped
      if ( typeof config === 'function' ) { callback = config; config = undefined; }

      // component is given as string?
      if ( typeof component === 'string' ) {

        // given string is component index? => proceed with already registered component object
        if ( component.indexOf( '.js' ) === -1 ) return proceed( components[ component ] );

        // given string is component URL
        else {

          /**
           * @type {ccm.types.component_index}
           */
          var index = self.helper.getIndex( component );

          // is already registered component? => proceed with already registered component object
          if ( components[ index ] ) return proceed( components[ index ] );

          // not registered component => load component file and proceed with resulting component object
          else self.load( component, proceed );

        }

      }
      // component is given as object => proceed with given object
      else return proceed( component );

      /**
       * @param {ccm.types.component_object} [component] - component object (default: abort)
       */
      function proceed( component ) {

        // no component object? => abort
        if ( !self.helper.isObject( component ) ) return;

        // set component name/version or index
        setNameVersionIndex();

        // component already registered? => skip registration
        if ( components[ component.index ] ) return finish();

        // register component
        components[ component.index ] = component;

        // create global namespace for component
        ccm.components[ component.index ] = {};

        // no Custom Element support? => load polyfill
        if ( !( 'registerElement' in document ) ) self.load( [
          'https://cdnjs.cloudflare.com/ajax/libs/document-register-element/0.5.3/document-register-element.js',
          'https://cdnjs.cloudflare.com/ajax/libs/webcomponentsjs/0.7.22/webcomponents-lite.min.js'
        ], proceed ); else return proceed();

        function proceed() {

          // setup component
          setup();

          // define HTML tag for component
          defineCustomElement();

          // initialize component
          if ( component.init ) { component.init( finish ); delete component.init; } else return finish();

          /**
           * setup component object
           */
          function setup() {

            component.instances = 0;  // add ccm instance counter
            component.ccm = self;     // add ccm framework reference

            // add function for creating and starting ccm instances
            component.instance = function ( config, callback ) { return self.instance( component.index, config, callback ); };
            component.start    = function ( config, callback ) { return self.start   ( component.index, config, callback ); };

            // set default of default ccm instance configuration
            if ( !component.config ) component.config = {};

            // set ccm framework reference for instances
            component.config.ccm = self;

          }

          /**
           * defines ccm Custom Element for component
           */
          function defineCustomElement() {

            var tag = Object.create( HTMLElement.prototype );
            tag.attachedCallback = function () {
              if ( !document.body.contains( this ) ) return;
              var node = this;
              while ( node = node.parentNode )
                if ( node.tagName && node.tagName.indexOf( 'CCM-' ) === 0 )
                  return;
              var config = self.helper.generateConfig( this );
              config.root = this;
              component.start( config );
            };
            try { document.registerElement( 'ccm-' + component.index, { prototype: tag } ); } catch ( err ) {}

          }

        }

        /** sets name/version or index of the component object */
        function setNameVersionIndex() {

          // has component index?
          if ( component.index ) {

            /**
             * name and version number of ccm component
             * @type {Array}
             */
            var array = component.index.split( '-' );

            // add name of ccm component
            component.name = array.shift();

            // add version number of ccm component
            if ( array.length > 0 ) component.version = array;

          }

          // component index is component name
          component.index = component.name;

          // has version? => append version number to component index
          if ( component.version )
            component.index += '-' + component.version.join( '-' );

        }

        /**
         * finishes registration of component
         */
        function finish() {

          // make deep copy of original registered component object
          component = self.helper.clone( components[ component.index ] );

          // component has individual default for default instance configuration?
          if ( config ) {

            // config is a HTML Element Node? => configuration has only root property (website area for embedding)
            if ( self.helper.isElementNode( config ) ) config = { root: config };

            // set individual default of default ccm instance configuration
            component.config = self.helper.integrate( self.helper.clone( config ), component.config );

            // open closure for correct later variable visibility
            closure( component );

          }
          
          // provide resulting component object
          if ( callback ) callback( component );
          return component;

          /**
           * @param {ccm.types.component_object} component - component object
           */
          function closure( component ) {

            // consider default for default instance configuration in later instance() and start() calls
            component.instance = function ( config, callback ) { return perform( self.instance, config, callback ); };
            component.start    = function ( config, callback ) { return perform( self.start   , config, callback ); };

            function perform( method, config, callback ) {

              // config parameter is a function? => config skipped
              if ( typeof config === 'function' ) { callback = config; config = undefined; }

              // config is a HTML Element Node? => configuration has only root property (website area for embedding)
              if ( self.helper.isElementNode( config ) ) config = { root: config };

              // set instance configuration
              config = self.helper.integrate( config, self.helper.clone( component.config ) );

              // perform instance() or start() call
              return method( component.index, config, function ( instance ) {

                // set individual component object (with individual default instance configuration)
                instance.component = component;

                if ( callback ) callback( instance );
              } );
              
            }

          }

        }

      }

    },

    /**
     * @summary creates an <i>ccm</i> instance out of a <i>ccm</i> component
     * @memberOf ccm
     * @param {ccm.types.index|ccm.types.url} component - index, object or URL of a <i>ccm</i> component
     * @param {ccm.types.config|function} [config] - <i>ccm</i> instance configuration (check documentation of associated <i>ccm</i> component to see which properties could be set)
     * @param {function} [callback] - callback when <i>ccm</i> instance is created (first parameter is the created <i>ccm</i> instance)
     * @returns {ccm.types.instance} created <i>ccm</i> instance (only if synchron)
     * @example ccm.instance( 'ccm.chat.js', { key: 'demo' }, function ( instance ) {...} );
     */
    instance: function ( component, config, callback ) {

      // config parameter is a function? => config skipped
      if ( typeof config === 'function' ) { callback = config; config = undefined; }

      /**
       * @summary number of loading resources
       * @type {number}
       */
      var counter = 0;

      /**
       * result ccm instance
       * @type {ccm.types.instance}
       */
      var result;

      /**
       * @summary waitlist of unsolved dependencies
       * @type {ccm.types.action[]}
       */
      var waiter = [];

      // start recursion to solve dependencies
      return recursive( component, config );

      /**
       * recursion to create instance and solve dependencies (in breadth-first-order)
       * @param {string|object} comp - index, object or URL of component
       * @param {ccm.types.config} [cfg={}] - instance configuration (current recursive level)
       * @param {ccm.types.config} [prev_cfg] - parent instance configuration (previous recursive level)
       * @param {string} [prev_key] - relevant key in parent instance configuration (previous recursive level)
       * @param {string} [parent] - parent instance (previous recursive level)
       * @returns {ccm.types.instance} created instance (only if synchron)
       */
      function recursive( comp, cfg, prev_cfg, prev_key, parent ) {

        // increase number of loading resources
        counter++;

        // make sure that the component is registered and get it's component index
        var async = false;
        var comp = self.component( comp, function ( comp ) {
          if ( async ) proceed( comp.index );
        } );
        if ( comp ) return proceed( comp.index );
        async = true;

        /**
         * @param {ccm.types.index} index - component index
         * @returns {ccm.types.instance} created ccm instance (only if synchron)
         */
        function proceed( index ) {

          // load instance configuration if necessary (asynchron)
          if ( self.helper.isDependency( cfg ) ) cfg = { key: cfg };
          if ( cfg && cfg.key ) {
            if ( self.helper.isObject( cfg.key ) )
              return integrate( self.helper.clone( cfg.key ) );
            else if ( self.helper.isDependency( cfg.key ) )
              return cfg.key[ 0 ] === 'ccm.load' ? self.load( cfg.key[ 1 ], integrate ) : self.get( cfg.key[ 1 ], cfg.key[ 2 ], integrate );
            else {
              delete cfg.key;
              proceed( cfg );
            }
          }
          else return proceed( cfg );
          function integrate( dataset ) {
            self.helper.integrate( cfg, dataset );
            delete dataset.key;
            return proceed( dataset );
          }

          function proceed( cfg ) {

            // no Shadow DOM support? => load polyfill
            if ( !document.head.attachShadow || !document.head.createShadowRoot ) self.load( 'https://kaul.inf.h-brs.de/ccm/lib/shadydom.min.js', proceed ); else return proceed();

            function proceed() {

              // config is a HTML Element Node? => configuration has only root property (website area for embedding)
              if ( self.helper.isElementNode( cfg ) ) cfg = { root: cfg };

              /**
               * created instance
               * @type {ccm.types.instance}
               */
              var instance = new components[ index ].Instance();

              // integrate created instance
              components[ index ].instances++;                    // increment instance counter
              if ( prev_cfg ) prev_cfg[ prev_key ] = instance;    // set instance in instance configuration (previous recursive level)
              if ( parent ) instance.parent = parent;             // set parent instance
              if ( !result ) result = instance;                   // set result instance

              // configure created instance
              self.helper.integrate( self.helper.clone( components[ index ].config ), instance );  // set default ccm instance configuration
              if ( cfg ) self.helper.integrate( cfg, instance );  // integrate ccm instance configuration
              instance.id = components[ index ].instances;        // set ccm instance id
              instance.index = index + '-' + instance.id;         // set ccm instance index
              instance.component = components[ index ];           // set ccm component reference
              setElement();                                       // set website area

              /*
              if ( instance.root.parentNode ) {
                instance.root.parent_node = instance.root.parentNode;
                instance.root.temp_node = document.createElement( 'div' );
                instance.root.temp_node.classList.add( 'temp' );
                instance.root.parent_node.insertBefore( instance.root.temp_node, instance.root );
                document.head.appendChild( instance.root );
              }
              console.log( instance.index, instance.root, instance.root.shadowRoot, instance.root.parent_node, instance.root.temp_node );
              */

              // solve dependencies of created ccm instance
              solveDependencies( instance );

              // check if all dependencies are solved
              return check();

              /** set the website area for the created instance */
              function setElement() {

                // keyword 'parent'? => use parent website area (and abort)
                if ( instance.root === 'parent' ) {
                  instance.root = instance.parent.root;
                  instance.element = instance.parent.element;
                  return;
                }

                // keyword 'name'? => use inner website area of the parent where HTML ID is equal to component name of created instance
                if ( instance.root === 'name' ) instance.root = instance.parent.element.querySelector( '#' + instance.component.name );

                // no website area? => use on-the-fly element
                if ( !instance.root ) instance.root = document.createElement( 'div' );

                // no DOM contact? => put root element into <head>
                if ( !instance.root.parentNode ) document.head.appendChild( instance.root );

                // prepare website area for ccm instance
                var element = self.helper.html( { id: 'element' } );

                // create shadow DOM
                var shadow = instance.root.attachShadow( { mode: 'open' } );
                shadow.appendChild( element );

                // prepared website area is website area for created instance
                instance.element = element;
                //console.log( instance.root, instance.element, instance.root.parentNode );

              }

              /**
               * solve dependencies of created ccm instance (recursive)
               * @param {ccm.types.instance|Array} instance_or_array - ccm instance or inner array
               */
              function solveDependencies( instance_or_array ) {

                // iterate over all ccm instance properties
                for ( var key in instance_or_array ) {

                  /**
                   * property value
                   * @type {*}
                   */
                  var value = instance_or_array[ key ];

                  // is dependency? => solve dependency
                  if ( self.helper.isDependency( value ) ) solveDependency( instance_or_array, key );

                  // value is an array or object?
                  else if ( typeof value === 'object' && value !== null ) {

                    // not relevant object type? => skip
                    if ( self.helper.isNode( value ) || self.helper.isInstance( value ) || self.helper.isComponent( value ) ) continue;

                    // search it for dependencies (recursive call)
                    solveDependencies( value );

                  }

                }

                /**
                 * solve ccm instance dependency
                 * @param {ccm.types.instance|Array} instance_or_array - ccm instance or inner array
                 * @param {string|number} key - ccm instance property key or array index
                 */
                function solveDependency( instance_or_array, key ) {

                  /**
                   * ccm instance dependency that must be solved
                   * @type {ccm.types.action}
                   */
                  var action = instance_or_array[ key ];

                  // check type of dependency => solve dependency
                  switch ( action[ 0 ] ) {

                    case 'ccm.load':
                      counter++;
                      action.shift();
                      setContext( action );
                      action.push( setResult ); self.load.apply( null, action );
                      break;

                    case 'ccm.component':
                      counter++;
                      if ( !action[ 2 ] ) action[ 2 ] = {};
                      action[ 2 ].parent = instance;
                      self.component( action[ 1 ], action[ 2 ], function ( result ) { setResult( result ); } );
                      break;

                    case 'ccm.instance':
                      waiter.push( [ recursive, action[ 1 ], action[ 2 ], instance_or_array, key, instance ] );
                      break;

                    case 'ccm.proxy':
                      proxy( action[ 1 ], action[ 2 ], instance_or_array, key, instance );
                      break;

                    case 'ccm.store':
                      counter++;
                      if ( !action[ 1 ] ) action[ 1 ] = {};
                      action[ 1 ].delayed = true;
                      self.store( action[ 1 ], setResult );
                      break;

                    case 'ccm.get':
                      counter++;
                      self.get( action[ 1 ], action[ 2 ], setResult );
                      break;

                    case 'ccm.set':
                      counter++;
                      self.set( action[ 1 ], action[ 2 ], setResult );
                      break;

                    case 'ccm.del':
                      counter++;
                      self.del( action[ 1 ], action[ 2 ], setResult );
                      break;
                  }

                  function setContext( resources ) {
                    for ( var i = 0; i < resources.length; i++ ) {
                      if ( Array.isArray( resources[ i ] ) ) return setContext( resources[ i ] );
                      if ( !self.helper.isObject( resources[ i ] ) ) resources[ i ] = { url: resources[ i ] };
                      if ( !resources[ i ].context ) resources[ i ].context = instance.element.parentNode;
                    }
                  }

                  /**
                   * set result of solved ccm instance dependency
                   * @param {*} result
                   */
                  function setResult( result ) {

                    // set result of solved ccm instance dependency
                    instance_or_array[ key ] = result;

                    // check if all ccm instance dependencies are solved
                    check();

                  }

                  /**
                   * create proxy for lazy loading ccm instance
                   * @param {string} component - URL of ccm component
                   * @param {ccm.types.config} [config={}] - ccm instance configuration, see documentation of associated ccm component
                   * @param {ccm.types.instance|Array} instance_or_array - parent ccm instance or inner array
                   * @param {string|number} key - parent ccm instance property key or array index
                   * @param {ccm.types.instance} parent - parent ccm instance
                   */
                  function proxy( component, config, instance_or_array, key, parent ) {

                    // load instance configuration if necessary (asynchron)
                    self.helper.isDependency( config ) ? self.get( config[ 1 ], config[ 2 ], proceed ) : proceed( config );

                    function proceed( config ) {

                      instance_or_array[ key ] = {
                        component: component,
                        parent: parent,
                        start: function ( callback ) {
                          delete this.component;
                          delete this.start;
                          if ( !config ) config = {};
                          self.helper.integrate( this, config );
                          self.start( component, config, function ( instance ) {
                            instance_or_array[ key ] = instance;
                            if ( callback ) callback();
                          } );
                        }
                      };

                    }

                  }

                }

              }

              /**
               * check if all ccm instance dependencies are solved
               * @returns {ccm.types.instance} created instance (nur wenn synchron)
               */
              function check() {

                // decrease number of loading resources
                counter--;

                // are all ccm instance dependencies solved?
                if ( counter === 0 ) {

                  /*
                  if ( instance.root.parent_node ) instance.root.parent_node.appendChild( instance.root );
                  //if ( instance.root.parent_node ) instance.root.parent_node.replaceChild( instance.root, instance.root.temp_node );
                  console.log( instance.root.parent_node );
                  */

                  // waitlist not empty? => continue with waiting unsolved dependencies
                  if ( waiter.length > 0 ) return self.helper.action( waiter.shift() );  // recursive call

                  // initialize created instances (start recursive with result instance)
                  initialize( result, function () {

                    // root element is a child of <head>? => remove it from <head> (but keep reference)
                    if ( result.root.parentNode === document.head ) document.head.removeChild( result.root );

                    // perform callback with result instance
                    if ( callback ) callback( result );

                  } );

                }

                // return result instance (only synchron)
                return counter === 0 ? result : null;

              }

              /**
               * initialize ccm instance and all its dependent ccm instances and datastores (recursive)
               * @param {ccm.types.instance|object|Array} instance - ccm instance or inner object or array
               * @param {function} callback
               */
              function initialize( instance, callback ) {

                /**
                 * founded ccm instances and datastores
                 * @type {Array.<ccm.types.instance|ccm.Datastore>}
                 */
                var results = [ instance ];

                // find all ccm instances
                find( instance );

                // see order of results
                //console.log( 'ccm#initialize', instance.index, results.map( function ( result ) { return result.index } ) );

                // initialize all founded ccm instances
                var i = 0; init();

                /**
                 * find all ccm instances and datastores (breadth-first-order, recursive)
                 * @param {object} obj - object
                 */
                function find( obj ) {

                  /**
                   * founded relevant inner objects and arrays
                   * @type {Array.<object|Array>}
                   */
                  var inner = [];

                  // find all dependent ccm instances
                  for ( var key in obj ) {
                    var value = obj[ key ];

                    // value is a ccm instance? (but not parent and not a ccm proxy instance) => add to founded relevant inner object and arrays
                    if ( self.helper.isInstance( value ) && key !== 'parent' && !self.helper.isProxy( value) ) inner.push( value );

                    // value is an array or object?
                    else if ( Array.isArray( value ) || self.helper.isObject( value ) ) {

                      // not relevant object type? => skip
                      if ( self.helper.isNode( value ) || self.helper.isComponent( value ) || self.helper.isInstance( value ) ) continue;

                      // add to founded relevant inner object and arrays
                      inner.push( value );

                    }

                  }

                  // add founded inner ccm instances and datastores to results
                  inner.map( function ( obj ) { if ( self.helper.isInstance( obj ) || self.helper.isDatastore( obj ) ) results.push( obj ); } );

                  // go deeper (recursive calls)
                  inner.map( function ( obj ) { find( obj ); } );

                }

                /**
                 * initialize all founded ccm instances and datastores (recursive, asynchron)
                 */
                function init() {

                  // all results initialized? => perform ready functions
                  if ( i === results.length ) return ready();

                  /**
                   * first founded and not init-checked result
                   * @type {ccm.types.instance|ccm.Datastore}
                   */
                  var obj = results[ i ]; i++;

                  // result is not initialized? => perform init function and check next result afterwards (recursive call)
                  if ( obj.init ) obj.init( function () { delete obj.init; init(); } ); else init();

                }

                /**
                 * performs ready function of each founded ccm instance (recursive, asynchron)
                 */
                function ready() {

                  // all ready functions are called? => perform callback
                  if ( results.length === 0 ) return callback();

                  /**
                   * last founded and not ready-checked result
                   * @type {ccm.types.instance}
                   */
                  var obj = results.pop();

                  // delete init function
                  delete obj.init;

                  // result has a ready function? => perform and delete ready function and check next result afterwards (recursive call)
                  if ( obj.ready ) { var tmp = obj.ready; delete obj.ready; tmp( ready ); } else ready();

                }

              }

            }

          }

        }

      }

    },

    /**
     * @summary starts <i>ccm</i> instance
     * @memberOf ccm
     * @param {ccm.types.index|ccm.types.url} component - index or URL of a <i>ccm</i> component
     * @param {ccm.types.config} [config] - <i>ccm</i> instance configuration (check documentation of associated <i>ccm</i> component to see which properties could be set)
     * @param {function} [callback] - callback when <i>ccm</i> instance is started (first parameter is the started <i>ccm</i> instance)
     * @returns {ccm.types.instance} started <i>ccm</i> instance (only if synchron)
     * @example ccm.start( 'ccm.blank.js', { element: jQuery( '#container' ) } );
     */
    start: function ( component, config, callback ) {

      // config parameter is a function? => config skipped
      if ( typeof config === 'function' ) { callback = config; config = undefined; }

      // create ccm instance out of ccm component
      self.instance( component, config, function ( instance ) {

        // start ccm instance
        instance.start( function () {

          // perform callback with ccm instance
          if ( callback ) callback( instance );

        } );

      } );

    },

    /**
     * @summary provides a <i>ccm</i> datastore
     * @description
     * A <i>ccm</i> datastore could be used for easy data management on different switchable data levels.
     * With no first parameter the method provides a empty <i>ccm</i> datastore of data level 1.
     * In this case the callback could be the first parameter directly.
     * See [this wiki page]{@link https://github.com/akless/ccm-developer/wiki/Data-Management} for general informations about <i>ccm</i> data management.
     * @memberOf ccm
     * @param {ccm.types.settings} [settings={}] - <i>ccm</i> datastore settings (see [here]{@link ccm.types.settings} for more details)
     * @param {ccm.types.storeResult} [callback] - when datastore is ready for use
     * @returns {ccm.Datastore} <i>ccm</i> datastore (only if no inner operation is asynchron)
     * @example
     * // get result as first parameter of the callback
     * var settings = {...};
     * ccm.store( settings, function ( result ) { console.log( result ); } );
     * @example
     * // get result as return value (only if no inner operation is asynchron)
     * var settings = {...};
     * var result = ccm.store( settings );
     * console.log( result );
     * @example
     * // provides a empty <i>ccm</i> datastore of data level 1
     * ccm.store( function ( result ) { console.log( result ); } );
     * // without given settings the callback could be the first parameter directly
     * @example
     * // provides a empty <i>ccm</i> datastore of data level 1
     * ccm.store( function ( result ) { console.log( result ); } );
     * // without given settings the callback could be the first parameter directly
     */
    store: function ( settings, callback ) {

      // given settings are a function? => settings are callback
      if ( typeof settings === 'function' ) { callback = settings; settings = undefined; }

      // no given settings? => use empty object
      if ( !settings ) settings = {};

      // given settings are an URL or a collection of ccm datasets? => wrap object
      if ( typeof settings === 'string' || ( self.helper.isObject( settings ) && !settings.local && !settings.store && !settings.url && !settings.delayed && !settings.user ) ) settings = { local: settings };

      // make deep copy of given settings
      settings = self.helper.clone( settings );

      /**
       * ccm datastore source
       * @type {string}
       */
      var source = getSource( settings );

      // existing ccm datastore have the same source?
      if ( stores[ source ] ) {

        // perform callback with existing ccm datastore
        if ( callback ) callback( stores[ source ] );

        // return existing ccm datastore
        return stores[ source ];

      }

      // add ccm datastore source to ccm datastore settings
      if ( !settings.source ) settings.source = source;

      // no local cache? => use empty object
      if ( !settings.local ) settings.local = {};

      // local cache is an URL? => load initial datasets for local cache (could be asynchron)
      if ( typeof settings.local === 'string' ) self.load( settings.local, proceed ); else return proceed( settings.local );

      /**
       * proceed with creating ccm datastore
       * @param {ccm.types.datasets} datasets - initial datasets for local cache
       * @returns {ccm.Datastore} created ccm datastore
       */
      function proceed( datasets ) {

        // set initial datasets for local cache
        settings.local = datasets;

        // prepare ccm database if necessary (asynchron)
        return settings.store && !settings.url ? prepareDB( proceed ) : proceed();

        /**
         * prepare ccm database
         * @param {function} callback
         */
        function prepareDB( callback ) {

          // open ccm database if necessary (asynchron)
          !db ? openDB( proceed ) : proceed();

          /**
           * open ccm database
           * @param {function} callback
           */
          function openDB( callback ) {

            /**
             * request for opening ccm database (asynchron)
             * @type {object}
             */
            var request = indexedDB.open( 'ccm' );

            // set success callback
            request.onsuccess = function () {

              // set database object
              db = this.result;

              // perform callback
              callback();

            };

          }

          /**
           * proceed with preparing ccm database
           */
          function proceed() {

            // needed object store in IndexedDB not exists? => update ccm database (asynchron)
            !db.objectStoreNames.contains( settings.store ) ? updateDB( callback ) : callback();

            /**
             * update ccm database
             * @param {function} callback
             */
            function updateDB( callback ) {

              /**
               * current ccm database version number
               * @type {number}
               */
              var version = parseInt( localStorage.getItem( 'ccm' ) );

              // no version number? => start with 1
              if ( !version ) version = 1;

              // close ccm database
              db.close();

              /**
               * request for reopening ccm database
               * @type {object}
               */
              var request = indexedDB.open( 'ccm', version + 1 );

              // set onupgradeneeded callback
              request.onupgradeneeded = function () {

                // set database object
                db = this.result;

                // save new ccm database version number in local storage
                localStorage.setItem( 'ccm', db.version );

                // create new object store
                db.createObjectStore( settings.store, { keyPath: 'key' } );

              };

              // set success callback => perform callback
              request.onsuccess = callback;

            }

          }

        }

        /**
         * proceed with creating ccm datastore
         * @returns {ccm.Datastore} created ccm datastore
         */
        function proceed() {

          /**
           * created ccm datastore
           * @type {ccm.Datastore}
           */
          var store = new Datastore();

          // integrate settings in ccm datastore
          self.helper.integrate( settings, store );

          // is ccm realtime datastore?
          if ( store.url && store.url.indexOf( 'ws' ) === 0 ) {

            // prepare initial message
            var message = [ store.db, store.store ];
            if ( store.datasets )
              message = message.concat( store.datasets );

            // connect to server
            store.socket = new WebSocket( store.url, 'ccm' );

            // send initial message
            store.socket.onopen = function () { this.send( message ); proceed(); };

          }
          else return proceed();

          /**
           * proceed with creating ccm datastore
           * @returns {ccm.Datastore} created ccm datastore
           */
          function proceed() {

            // delete no more needed property
            delete store.datasets;

            // no delayed initialization?
            if ( !store.delayed ) {

              // initialize ccm datastore
              store.init();

              // delete init function after one-time call
              delete store.init;

            }
            // skipped initialization => delete delayed flag
            else delete store.delayed;

            // add ccm datastore to created ccm datastores
            stores[ source ] = store;

            // perform callback with created ccm datastore
            if ( callback ) callback( store );

            // return created ccm datastore (only synchron)
            return store;

          }

        }

      }

    },

    /**
     * @summary get directly a <i>ccm</i> dataset out of a <i>ccm</i> datastore
     * @memberOf ccm
     * @param {ccm.types.settings} [settings] - <i>ccm</i> datastore settings
     * @param {string|object} [key_or_query] - unique key of the dataset or alternative a query (it's possible to use dot notation to get a specific inner property of single dataset)
     * @param {function} [callback] - callback (first parameter is the requested <i>ccm</i> datastore)
     */
    get: function ( settings, key_or_query, callback ) {

      self.store( settings, function ( store ) {

        var property;
        if ( typeof key_or_query === 'string' ) property = key_or_query.split( '.' );
        key_or_query = property.shift();
        property = property.join( '.' );

        store.get( key_or_query, function ( result ) {

          callback( property ? self.helper.deepValue( result, property ) : result );

        } );

      } );

    },

    set: function ( settings, priodata, callback ) {

      self.store( settings, function ( store ) {

        store.set( priodata, callback );

      } );

    },

    del: function ( settings, key, callback ) {

      self.store( settings, function ( store ) {

        store.del( key, callback );

      } );

    },

    /*-------------------------------------------- public ccm namespaces ---------------------------------------------*/

    /**
     * @summary context functions for traversing in a <i>ccm</i> context tree
     * @memberOf ccm
     * @namespace
     * @ignore
     */
    context: {

      /**
       * @summary find parent instance by property
       * @param {ccm.types.instance} instance - <i>ccm</i> instance (starting point)
       * @param {string} property - instance property
       * @returns {ccm.types.instance} highest result in current ccm context
       */
      find: function ( instance, property ) {

        var start = instance;
        while ( instance = instance.parent )
          if ( instance[ property ] && instance[ property ] !== start )
            return instance[ property ];

      },

      /**
       * @summary get <i>ccm</i> context root
       * @param {ccm.types.instance} instance - <i>ccm</i> instance (starting point)
       * @returns {ccm.types.instance}
       */
      root: function ( instance ) {

        while ( instance.parent )
          instance = instance.parent;

        return instance;

      }

    },

    /**
     * @summary helper functions for <i>ccm</i> component developers
     * @memberOf ccm
     * @namespace
     */
    helper: {

      /**
       * @summary perform action (# for own context)
       * @param {ccm.types.action} action
       * @param {object} [context]
       * @returns {*} return value of performed action
       */
      action: function ( action, context ) {

        // is function without parameters? => perform function
        if ( typeof action === 'function' ) return action();

        if ( typeof action !== 'object' )
          action = action.split( ' ' );

        if ( typeof action[ 0 ] === 'function' )
          return action[ 0 ].apply( window, action.slice( 1 ) );
        else
        if ( action[ 0 ].indexOf( 'this.' ) === 0 )
          return this.executeByName( action[ 0 ].substr( 5 ), action.slice( 1 ), context );
        else
          return this.executeByName( action[ 0 ], action.slice( 1 ) );
      },

      append: function ( parent, node ) {

        node = self.helper.protect( node );
        parent.appendChild( node );

      },

      /**
       * @summary create a deep copy of a given value
       * @param {*} value - given value
       * @returns {*} deep copy of given value
       */
      clone: function ( value ) {

        return recursive( value );

        function recursive( value ) {

          if ( self.helper.isNode( value ) || self.helper.isInstance( value ) ) return value;

          if ( Array.isArray( value ) || self.helper.isObject( value ) ) {
            var copy = Array.isArray( value ) ? [] : {};
            for ( var i in value )
              copy[ i ] = recursive( value[ i ] );
            return copy;
          }

          return value;

        }

      },

      /**
       * @summary converts dot notations in object keys to deeper properties
       * @param {object} obj - contains object keys in dot notation
       * @returns {object} object with converted object keys
       * @example
       * var obj = { test: 123, 'foo.bar': 'abc', 'foo.baz': 'xyz' };
       * var result = ccm.helper.convertObjectKeys( obj );
       * console.log( result );  // => { test: 123, foo: { bar: 'abc', baz: 'xyz' } }
       */
      convertObjectKeys: function ( obj ) {

        var keys = Object.keys( obj );
        keys.map( function ( key ) {
          if ( key.indexOf( '.' ) !== -1 ) {
            self.helper.deepValue( obj, key, obj[ key ] );
            delete obj[ key ];
          }
        } );
        return obj;

      },

      dataset: function ( store, key, callback ) {
        if ( typeof key === 'function' ) {
          callback = key;
          if ( store.store ) {
            key = store.key;
            store = store.store;
          }
          else return callback( store );
        }
        if ( !key ) key = self.helper.generateKey();
        store.get( key, function ( dataset ) {
          callback( dataset === null ? { key: key } : dataset );
        } );
      },

      decodeDependencies: function ( obj ) {

        for ( var key in obj )
          if ( typeof obj[ key ] === 'string' && /^\[\W*ccm\.\w+.*\]$/.test( obj[ key ] ) )
            obj[ key ] = JSON.parse( obj[ key ].replace( /'/g, '"' ) );

      },

      /**
       * @summary get or set the value of a deeper object property
       * @param {object} obj - object that contains the deeper property
       * @param {string} key - key path to the deeper property in dot notation
       * @param {*} [value] - value that should be set for the deeper property
       * @returns {string} value of the deeper property
       * @example
       * var obj = {
       *   test: 123,
       *   foo: {
       *     bar: 'abc',
       *     baz: 'xyz'
       *   }
       * };
       * var result = ccm.helper.deepValue( obj, 'foo.bar' );
       * console.log( result ); // => 'abc'
       * @example
       * var obj = {};
       * var result = ccm.helper.deepValue( obj, 'foo.bar', 'abc' );
       * console.log( obj );    // => { foo: { bar: 'abc' } }
       * console.log( result ); // => 'abc'
       */
      deepValue: function ( obj, key, value ) {

        return recursive( obj, key.split( '.' ), value );

        /**
         * recursive helper function, key path is given as array
         */
        function recursive( obj, key, value ) {

          if ( !obj ) return;
          var next = key.shift();
          if ( key.length === 0 )
            return value !== undefined ? obj[ next ] = value : obj[ next ];
          if ( !obj[ next ] && value !== undefined ) obj[ next ] = {};
          return recursive( obj[ next ], key, value );                  // recursive call

        }

      },

      encodeDependencies: function ( obj ) {

        for ( var key in obj )
          if ( self.helper.isDependency( obj[ key ] ) )
            obj[ key ] = JSON.stringify( obj[ key ] ).replace( /"/g, "'" );

      },

      /**
       * @summary perform function by function name
       * @param {string} functionName - function name
       * @param {Array} [args] - function arguments
       * @param {object} [context] - context for this
       * @returns {*} return value of performed function
       * @ignore
       */
      executeByName: function ( functionName, args, context ) {

        if (!context) context = window;
        var namespaces = functionName.split( '.' );
        functionName = namespaces.pop();
        for ( var i = 0; i < namespaces.length; i++ )
          context = context[ namespaces[ i ]];
        return context[ functionName ].apply( context, args );
      },

      filterProperties: function ( obj, properties ) {
        var result = {};
        properties = self.helper.makeIterable( arguments );
        properties.shift();
        properties.map( function ( property ) {
          result[ property ] = obj[ property ];
        } );
        return result;
      },

      /**
       * @summary replaces placeholder in a string with given values
       * @param {string|object} string - string with containing placeholders
       * @param {...string} [values] - given values
       * @returns {string} string with replaced placeholders
       */
      format: function ( string, values ) {

        var functions = [[],[]];

        string = JSON.stringify( string, function( key, val ) {
          if ( typeof val === 'function' ) { functions[ 0 ].push( val ); return '%f0%'; }
          return val;
        } );

        for ( var i = 1; i < arguments.length; i++ ) {
          if ( typeof arguments[ i ] === 'function' ) { functions[ 1 ].push( arguments[ i ] ); arguments[ i ] = '%f1%'; }
          if ( typeof arguments[ i ] === 'object' )
            for ( var key in arguments[ i ] ) {
              if ( typeof arguments[ i ][ key ] === 'function' ) { functions[ 1 ].push( arguments[ i ][ key ] ); arguments[ i ][ key ] = '%f1%'; }
              if ( typeof arguments[ i ][ key ] === 'string' ) arguments[ i ][ key ] = escape( arguments[ i ][ key ] );
              string = string.replace( new RegExp( '%'+key+'%', 'g' ), arguments[ i ][ key ] );
            }
          else {
            if ( typeof arguments[ i ] === 'string' ) arguments[ i ] = escape( arguments[ i ] );
            string = string.replace( /%%/, arguments[ i ] );
          }
        }

        return JSON.parse( string, function ( key, val ) {
          if ( val === '%f0%' ) return functions[ 0 ].shift();
          if ( val === '%f1%' ) return functions[ 1 ].shift();
          return val;
        } );

        function escape( string ) {
          return string.replace( /"/g, "'" ).replace( /\\/g, '\\\\' ).replace( /\n/g, '\\n' ).replace( /\r/g, '\\r' ).replace( /\t/g, '\\t' ).replace( /\f/g, '\\f' );
        }

      },

      /**
       * @summary gets the input data of a form
       * @param {Element} form - HTML element which contains the input fields (must not be a HTML form tag)
       * @returns {object} input data
       * @example
       * var result = ccm.helper.formData( document.getElementsById( 'form_id' ) );
       * console.log( result );  // { username: 'JohnDoe', password: '1aA' }
       */
      formData: function ( form ) {

        var data = {};
        self.helper.makeIterable( form.querySelectorAll( '*[name]' ) ).map( function ( input ) {
          if ( input.getAttribute( 'type' ) === 'radio' ) {
            if ( input.checked ) data[ input.getAttribute( 'name' ) ] = input.value;
          }
          else if ( input.getAttribute( 'type' ) === 'checkbox' )
            data[ input.getAttribute( 'name' ) ] = input.checked ? ( input.value === 'on' ? true : input.value ) : '';
          else if ( input.getAttribute( 'type' ) === 'number' ) {
            var value = parseInt( input.value );
            if ( isNaN( value ) ) value = '';
            data[ input.getAttribute( 'name' ) ] = value;
          }
          else if ( !input.value )
            data[ input.getAttribute( 'name' ) ] = '';
          else
            data[ input.getAttribute( 'name' ) ] = input.value;
        } );
        return data;

      },

      /**
       * @summary generate instance configuration out of a HTML tag
       * @param {object} node - HTML tag
       * @returns {ccm.types.config}
       */
      generateConfig: function ( node ) {

        var config = {};
        catchAttributes( node, config );
        catchInnerTags( node );
        return config;

        function catchAttributes( node, obj ) {

          self.helper.makeIterable( node.attributes ).map( function ( attr ) {
            if ( attr.name !== 'src' ||
                 ( node.tagName.indexOf( 'CCM-COMPONENT' ) !== 0
                && node.tagName.indexOf( 'CCM-INSTANCE'  ) !== 0
                && node.tagName.indexOf( 'CCM-PROXY'     ) !== 0 ) )
              try { self.helper.deepValue( obj, attr.name, attr.value.charAt( 0 ) === '{' || attr.value.charAt( 0 ) === '[' ? JSON.parse( attr.value ) : prepareValue( attr.value ) ) } catch ( err ) {}
          } );

        }

        function catchInnerTags( node ) {

          config.childNodes = [];
          self.helper.makeIterable( node.childNodes ).map( function ( child ) {
            if ( child.tagName && child.tagName.indexOf( 'CCM-' ) === 0 ) {
              var split = child.tagName.toLowerCase().split( '-' );
              if ( split.length < 3 ) split[ 2 ] = split[ 1 ];
              switch ( split[ 1 ] ) {
                case 'load':
                  self.helper.deepValue( config, split[ 2 ], interpretLoadTag( child, split[ 2 ] ) );
                  break;
                case 'component':
                case 'instance':
                case 'proxy':
                  self.helper.deepValue( config, split[ 2 ], [ 'ccm.' + split[ 1 ], child.getAttribute( 'src' ) || split[ 2 ], self.helper.generateConfig( child ) ] );
                  break;
                case 'store':
                case 'get':
                  var settings = {};
                  catchAttributes( child, settings );
                  var key = settings.key;
                  delete settings.key;
                  self.helper.deepValue( config, split[ 2 ], [ 'ccm.' + split[ 1 ], settings, key ] );
                  break;
                case 'list':
                  var list = null;
                  self.helper.makeIterable( child.children ).map( function ( entry ) {
                    if ( entry.tagName && entry.tagName.indexOf( 'CCM-ENTRY' ) === 0 ) {
                      var value = prepareValue( entry.getAttribute( 'value' ) );
                      var split = entry.tagName.toLowerCase().split( '-' );
                      if ( !list )
                        list = split.length < 3 ? [] : {};
                      if ( split.length < 3 )
                        list.push( value );
                      else
                        self.helper.deepValue( list, split[ 2 ], value );
                    }
                  } );
                  if ( !list ) list = {};
                  catchAttributes( child, list );
                  if ( list ) self.helper.deepValue( config, split[ 2 ], list );
                  break;
                default:
                  config.childNodes.push( child );
                  node.removeChild( child );
              }
            }
            else {
              config.childNodes.push( child );
              node.removeChild( child );
            }
          } );
          config.inner = self.helper.html( {} );
          config.childNodes.map( function ( child ) {
            config.inner.appendChild( child );
          } );
          delete config.childNodes;
          if ( !config.inner.hasChildNodes() ) delete config.inner;

          function interpretLoadTag( node ) {

            var params = generateParameters( node );
            if ( !Array.isArray( params ) ) params = [ params ];
            params.unshift( 'ccm.load' );
            if ( node.hasAttribute( 'head' ) ) params.push( true );
            return params;

            function generateParameters( node ) {

              if ( node.hasAttribute( 'src' ) ) {
                if ( node.children.length === 0 )
                  return node.getAttribute( 'src' );
                var data = {};
                self.helper.makeIterable( node.children ).map( function ( child ) {
                  if ( child.tagName && child.tagName.indexOf( 'CCM-DATA-' ) === 0 )
                    data[ child.tagName.toLowerCase().split( '-' )[ 2 ] ] = child.getAttribute( 'value' );
                } );
                return [ node.getAttribute( 'src' ), data ];
              }
              var params = [];
              self.helper.makeIterable( node.children ).map( function ( child ) {
                if ( child.tagName === 'CCM-SERIAL' && ( node.tagName === 'CCM-PARALLEL' || node.tagName.indexOf( 'CCM-LOAD' ) === 0 )
                    || child.tagName === 'CCM-PARALLEL' && node.tagName === 'CCM-SERIAL' )
                  params.push( generateParameters( child ) );
              } );
              return params;

            }

          }

        }

        function prepareValue( value ) {
          if ( value === 'true'      ) return true;
          if ( value === 'false'     ) return false;
          if ( value === 'null'      ) return null;
          if ( value === 'undefined' ) return undefined;
          if ( value === ''          ) return '';
          if ( !isNaN( value )       ) return parseInt( value );
          return value;
        }

      },

      /**
       * @summary generates a unique key
       * @description
       * An automatic generated unique key is made up of three parts.
       * The first part is the current time in milliseconds.
       * The second part is an 'X' as separator between first and last part.
       * The last part is a random number.
       * @returns {ccm.types.key} unique key
       * @example console.log( ccm.helper.generateKey() );  // 1465718738384X6869462723575014
       */
      generateKey: function () {

        return Date.now() + 'X' + Math.random().toString().substr( 2 );

      },

      /**
       * @summary get HTML DOM ID of the website area for the content of an <i>ccm</i> instance
       * @param {ccm.types.instance} instance - <i>ccm</i> instance
       * @returns {string}
       */
      getElementID: function ( instance ) {

        return 'ccm-' + instance.index;

      },

      /**
       * @summary get ccm component index by URL
       * @param {string} url - ccm component URL
       * @returns {ccm.types.index} ccm component index
       */
      getIndex: function ( url ) {

        // url is already an ccm component index? => abort and return it
        if ( url.indexOf( '.js' ) === -1 ) return url;

        /**
         * from given url extracted filename of the ccm component
         * @type {string}
         */
        var filename = url.split( '/' ).pop();

        // abort if extracted filename is not a valid filename for a ccm component
        if ( !self.helper.regex( 'filename' ).test( filename ) ) return '';

        // filter and return the component index out of the extracted filename
        var split = filename.split( '.' );
        if ( split[ 0 ] === 'ccm' )
          split.shift();
        split.pop();
        if ( split[ split.length - 1 ] === 'min' )
          split.pop();
        return split.join( '-' );

      },

      hide: function ( instance ) {
        instance.element.parentNode.appendChild( self.helper.loading( instance ) );
        instance.element.style.display = 'none';
      },

      /**
       * @summary generate HTML with JSON (recursive)
       * @param {ccm.types.html|ccm.types.html[]} html - <i>ccm</i> HTML data
       * @param {...string} [values] - values to replace placeholder
       * @returns {Element|Element[]} generated HTML
       */
      html: function( html, values ) {

        // HTML element instead of HTML data? => abort (result is given HTML element)
        if ( self.helper.isNode( html ) ) return html;

        // clone HTML data
        html = self.helper.clone( html );

        // replace placeholder
        if ( arguments.length > 1 ) html = self.helper.format.apply( this, arguments );

        // get more than one HTML tag?
        if ( Array.isArray( html ) ) {

          // generate each HTML tag
          var result = [];
          for ( var i = 0; i < html.length; i++ )
            result.push( self.helper.html( html[ i ] ) );  // recursive call
          return result;

        }

        // get no ccm html data? => return parameter value
        if ( typeof html !== 'object' ) return html;

        /**
         * HTML tag
         * @type {ccm.types.element}
         */
        var element = document.createElement( self.helper.htmlEncode( html.tag || 'div' ) );

        // remove 'tag' and 'key' property
        delete html.tag; delete html.key;

        // iterate over ccm html data properties
        for ( var key in html ) {

          /**
           * value of ccm html data property
           * @type {string|ccm.types.html|Array}
           */
          var value = html[ key ];

          // interpret ccm html data property
          switch ( key ) {

            // HTML boolean attributes
            case 'async':
            case 'autofocus':
            case 'checked':
            case 'defer':
            case 'disabled':
            case 'ismap':
            case 'multiple':
            case 'readonly':
            case 'required':
            case 'selected':
              if ( value ) element[ key ] = true;
              break;

            // inner HTML
            case 'inner':
              if ( typeof value === 'string' || typeof value === 'number' ) { element.innerHTML = value; break; }
              var children = this.html( value );  // recursive call
              if ( !Array.isArray( children ) )
                children = [ children ];
              for ( var i = 0; i < children.length; i++ )
                if ( self.helper.isElementNode( children[ i ] ) )
                  element.appendChild( children[ i ] );
                else
                  element.innerHTML += children[ i ];
              break;

            // HTML value attributes and events
            default:
              if ( key.indexOf( 'on' ) === 0 && typeof value === 'function' )  // is HTML event
                element.addEventListener( key.substr( 2 ), value );
              else                                                             // is HTML value attribute
                element.setAttribute( key, self.helper.htmlEncode( value ) );
          }

        }

        // return generated HTML
        return self.helper.protect( element );

      },

      /**
       * @summary HTML-encode a string
       * @see http://stackoverflow.com/questions/1219860/html-encoding-in-javascript-jquery
       * @param {string} value - string
       * @param {boolean} [trim=true] - .trim()
       * @param {boolean} [quot=true] - .replace( /"/g, '&quot;' )
       * @returns {string} HTML-encoded string
       */
      htmlEncode: function ( value, trim, quot ) {

        if ( typeof value !== 'string' ) value = value.toString();
        value = trim || trim === undefined ? value.trim() : value;
        value = document.createElement( 'a' ).appendChild( document.createTextNode( value ) ).parentNode.innerHTML;
        value = quot || quot === undefined ? value.replace( /"/g, '&quot;' ) : value;
        return value;

      },

      /**
       * @summary integrate priority data into a given dataset
       * @description
       * Each value of each property in the given priority data will be set in the given dataset for the property of the same name.
       * This method also supports dot notation in given priority data to set a single deeper property in the given dataset.
       * With no given priority data, the result is the given dataset.
       * With no given dataset, the result is the given priority data.
       * @param {object} [priodata] - priority data
       * @param {object} [dataset] - dataset
       * @returns {object} dataset with integrated priority data
       * @example
       * var dataset  = { firstname: 'John', lastname: 'Doe', fullname: 'John Doe' };
       * var priodata = { lastname: 'Done', fullname: undefined };
       * var result = ccm.helper.integrate( priodata, dataset );
       * console.log( result );  // { firstname: 'John', lastname: 'Done', fullname: undefined };
       * @example
       * var result = ccm.helper.integrate( { foo: { a: 'x': b: 'y' } }, { 'foo.c': 'z' } );
       * console.log( result );  // { foo: { a: 'x', b: 'y', c: 'z' } }
       * @example
       * var result = ccm.helper.integrate( { value: 'foo' } );
       * console.log( result );  // { value: 'foo' }
       * @example
       * var result = ccm.helper.integrate( undefined, { value: 'foo' } );
       * console.log( result );  // { value: 'foo' }
       */
      integrate: function ( priodata, dataset, as_defaults ) {

        // no given priority data? => return given dataset
        if ( !priodata ) return dataset;

        // no given dataset? => return given priority data
        if ( !dataset ) return priodata;

        // iterate over priority data properties
        for ( var key in priodata ) {

          // set value for the same property in the given dataset
          if ( !as_defaults || self.helper.deepValue( dataset, key ) === undefined ) self.helper.deepValue( dataset, key, priodata[ key ] );

        }

        // return dataset with integrated priority data
        return dataset;

      },

      /**
       * @summary check value for <i>ccm</i> component
       * @param {*} value - value to check
       * @returns {boolean}
       */
      isComponent: function ( value ) {

        return self.helper.isObject( value ) && value.Instance && true;

      },

      /**
       * check value for <i>ccm</i> dataset
       * @param {*} value - value to check
       * @returns {boolean}
       */
      isDataset: function ( value ) {

        return self.helper.isObject( value );

      },

      /**
       * check value for <i>ccm</i> datastore
       * @param {*} value - value to check
       * @returns {boolean}
       */
      isDatastore: function ( value ) {

        return self.helper.isObject( value ) && value.get && value.set && value.del && true;

      },

      /**
       * check value if it is a <i>ccm</i> dependency
       * @param {*} value
       * @returns {boolean}
       * @example [ ccm.load, ... ]
       * @example [ ccm.component, ... ]
       * @example [ ccm.instance, ... ]
       * @example [ ccm.proxy, ... ]
       * @example [ ccm.start, ... ]
       * @example [ ccm.store, ... ]
       * @example [ ccm.get, ... ]
       * @example [ ccm.set, ... ]
       * @example [ ccm.del, ... ]
       */
      isDependency: function ( value ) {

        if ( Array.isArray( value ) )
          if ( value.length > 0 )
            switch ( value[ 0 ] ) {
              case 'ccm.load':
              case 'ccm.component':
              case 'ccm.instance':
              case 'ccm.proxy':
              case 'ccm.start':
              case 'ccm.store':
              case 'ccm.get':
              case 'ccm.set':
              case 'ccm.del':
                return true;
            }

        return false;

      },

      /**
       * @summary check value for HTML element node
       * @param {*} value - value to check
       * @returns {boolean}
       */
      isElementNode: function ( value ) {

        return value instanceof Element;
        //return self.helper.isNode( value ) && value.tagName && true;

      },

      isGoogleChrome: function () {

        return /Chrome/.test( navigator.userAgent ) && /Google Inc/.test( navigator.vendor );

      },

      /**
       * @summary check value for <i>ccm</i> instance
       * @param {*} value - value to check
       * @returns {boolean}
       */
      isInstance: function ( value ) {

        return self.helper.isObject( value ) && value.component && true;

      },

      /**
       * @summary check value for HTML node
       * @param {*} value - value to check
       * @returns {boolean}
       */
      isNode: function ( value ) {

        return value instanceof Node;

      },

      /**
       * check value if it is an object (including not null and not array)
       * @param {*} value - value to check
       * @returns {boolean}
       */
      isObject: function ( value ) {

        return typeof value === 'object' && value !== null && !Array.isArray( value );

      },

      /**
       * @summary checks if a value is an ccm proxy instance
       * @param {*} value - value to check
       * @returns {boolean}
       * @example
       */
      isProxy: function ( value ) {

        return self.helper.isInstance( value ) && typeof value.component === 'string';

      },

      /**
       * @summary checks if an object is a subset of another object
       * @param {object} obj - object
       * @param {object} other - another object
       * @returns {boolean}
       * @example
       * var obj = {
       *   name: 'John Doe',
       *   counter: 3,
       *   isValid: true
       * };
       * var other = {
       *   name: 'John Doe',
       *   counter: 3,
       *   isValid: true,
       *   values: [ 'abc', 123, false ],
       *   settings: { title: 'Welcome!', year: 2017, greedy: true },
       *   onLoad: function () { console.log( 'Loading..' ); }
       * };
       * var result = ccm.helper.isSubset( obj, other );
       * console.log( result );  // => true
       */
      isSubset: function ( obj, other ) {

        for ( var i in obj )
          if ( typeof obj[ i ] === 'object' && typeof other[ i ] === 'object' ) {
            if ( JSON.stringify( obj[ i ] ) !== JSON.stringify( other[ i ] ) )
              return false;
          }
          else if ( obj[ i ] !== other[ i ] )
            return false;
        return true;

      },

      /**
       * @summary returns a <i>ccm</i> loading icon as HTML node element
       * @param {ccm.instance} instance - <i>ccm instance</i> (for determining Shadow DOM)
       * @types {ccm.types.node}
       * @example document.body.appendChild( ccm.helper.loading() );
       */
      loading: function ( instance ) {

        // set keyframe for ccm loading icon animation
        if ( !instance.element.parentNode.querySelector( '#ccm_keyframe' ) ) {
          var style = document.createElement( 'style' );
          style.id = 'ccm_keyframe';
          style.appendChild( document.createTextNode( '@keyframes ccm_loading { to { transform: rotate(360deg); } }' ) );
          instance.element.parentNode.appendChild( style );
        }

        return self.helper.html( { class: 'ccm_loading', inner: { style: 'display: inline-block; width: 0.5em; height: 0.5em; border: 0.15em solid #009ee0; border-right-color: transparent; border-radius: 50%; animation: ccm_loading 1s linear infinite;' } } );
      },

      /**
       * @summary make something that's nearly array-like iterable (see examples)
       * @param array_like
       * @returns {Array}
       * @example
       * // makes arguments of a function iterable
       * ccm.helper.makeIterable( arguments ).map( function ( arg ) { ... } );
       * @example
       * // makes the children of a HTML element node iterable
       * ccm.helper.makeIterable( document.getElementById( "dummy" ).children ).map( function ( child ) { ... } );
       * @example
       * // makes the attributes of a HTML element node iterable
       * ccm.helper.makeIterable( document.getElementById( "dummy" ).attributes ).map( function ( attr ) { ... } );
       */
      makeIterable: function ( array_like ) {
        return Array.prototype.slice.call( array_like );
      },

      /**
       * @summary performs minor finish actions
       * @param {ccm.types.instance} instance - finished <i>ccm</i> instance
       * @param {function|object|string} instance.onfinish - finish callback or settings for minor finish actions or global function name that should be called as finish callback
       * @param {ccm.types.instance} [instance.onfinish.user] - <i>ccm</i> user instance (user will be logged in if not already logged in)
       * @param {ccm.types.key} [instance.onfinish.key] - dataset key for result data
       * @param {ccm.types.settings} [instance.onfinish.store_settings] - settings for a <i>ccm</i> datastore (result data will be set in this datastore)
       * @param {object} [instance.onfinish.permissions] - permission settings for set operation
       * @param {boolean} [instance.onfinishn.user_specific] - do the set operation with a user-specific dataset key
       * @param {object} [instance.onfinish.clear] - clear own website area
       * @param {boolean} [instance.onfinish.restart] - restart finished <i>ccm</i> instance
       * @param {string} [instance.onfinish.embed_code] - show embed code if results are a instance configuration (value is component name)
       * @param {boolean} [instance.onfinish.log] - log result data in browser console
       * @param {object} [instance.onfinish.render] - render other content (could be <i>ccm</i> HTML data or data for embedding another component)
       * @param {callback} [instance.onfinish.callback] - additional individual finish callback (will be called after the performed minor actions)
       * @param {object} results - result data
       * @example
       * instance.onfinish = {
       *   user: instance.user,
       *   key: 'example',
       *   store_settings: { store: 'example', url: 'path/to/server/interface.php' },
       *   permissions: {
       *     creator: 'akless2m',
       *     group: {
       *       mkaul2m: true,
       *       akless2s: true
       *     },
       *     access: {
       *       get: 'all',
       *       set: 'group',
       *       del: 'creator'
       *     }
       *   },
       *   user_specific: true,
       *   embed_code: 'component_name',
       *   embed_code_url: 'path/to/ccm.component.js',
       *   clear: true,
       *   restart: true,
       *   log: true,
       *   render: [ 'component_url', [ "ccm.get", "configs.json", "dataset_key" ] ],
       *   callback: function ( instance, results ) { console.log( results ); }
       * };
       */
      onFinish: function ( instance, results ) {

        // no finish callback? => abort
        if ( !instance.onfinish ) return;

        // has only function? => abort and call it as finish callback
        if ( typeof instance.onfinish === 'function' ) return instance.onfinish( instance, results );

        // has only string as global function name? => abort and call it as finish callback
        if ( typeof instance.onfinish === 'string' ) return this.executeByName( instance.onfinish, [ instance, results ] );

        // has user instance? => login user
        if ( instance.onfinish.user ) instance.onfinish.user.login( proceed ); else proceed();

        function proceed() {

          // has to add a dataset key to result data? => do it (if not already exists)
          if ( instance.onfinish.key && !results.key ) results.key = instance.onfinish.key;

          // has to store result data in a ccm datastore?
          if ( instance.onfinish.store_settings ) {

            /**
             * dataset which contains resulting data
             * @type {ccm.types.dataset}
             */
            var dataset = self.helper.clone( results );

            // has to add permission settings? => do it
            if ( instance.onfinish.permissions ) dataset._ = instance.onfinish.permissions;

            // need user-specific dataset? => make dataset key user-specific
            if ( instance.onfinish.user && instance.onfinish.user_specific ) dataset.key = [ dataset.key || self.helper.generateKey(), instance.onfinish.user.data().key ];

            // set dataset in ccm datastore
            self.set( instance.onfinish.store_settings, dataset, function ( result ) {

              // show embed code
              var url = instance.onfinish.embed_code_url ? '<script src="'+instance.onfinish.embed_code_url+'"></script>' : '';
              if ( instance.onfinish.embed_code ) alert( url + '<ccm-' + instance.onfinish.embed_code + ' key=\'["ccm.get",' + JSON.stringify( instance.onfinish.store_settings ) + ',"' + result.key + '"]\'></ccm-' + instance.onfinish.embed_code + '>' );

              proceed();
            } );

          } else proceed();

          function proceed() {

            // has to clear own website area? => do it
            if ( instance.onfinish.clear ) instance.element.innerHTML = '';

            // has to restart the ccm instance? => do it
            if ( instance.onfinish.restart ) instance.start( proceed ); else proceed();

            function proceed() {

              // has to log result data? => do it
              if ( instance.onfinish.log ) console.log( results );

              // has to render other content?
              if ( instance.onfinish.render ) {
                if ( instance.onfinish.render.component ) {
                  var config = instance.onfinish.render.config;
                  if ( !config ) config = {};
                  config.element = instance.element;
                  self.start( instance.onfinish.render.component, config );
                }
                else
                  self.helper.setContent( instance.element, self.helper.html( instance.onfinish.render ) );
              }

              // has to a perform a callback? => do it
              if ( instance.onfinish.callback ) instance.onfinish.callback( instance, results );

            }

          }

        }

      },

      prepend: function ( parent, node ) {

        node = self.helper.protect( node );
        if ( parent.hasChildNodes() )
          parent.insertBefore( node, parent.firstChild );
        else
          parent.appendChild( node );

      },

      /**
       * @summary privatizes public members of an <i>ccm</i> instance
       * @description
       * Deletes all given properties in a given <i>ccm</i> instance and returns an object with the deleted properties and there values.
       * If no properties are given, then all not <i>ccm</i> relevant instance properties will be privatized.
       * List of <i>ccm</i> relevant properties that could not be privatized:
       * <ul>
       *   <li><code>childNodes</code></li>
       *   <li><code>component</code></li>
       *   <li><code>element</code></li>
       *   <li><code>id</code></li>
       *   <li><code>index</code></li>
       *   <li><code>onfinish</code></li>
       *   <li><code>node</code></li>
       *   <li><code>parent</code></li>
       * </ul>
       * In addition to this properties all functions and depending <i>ccm</i> context relevant <i>ccm</i> instances will also not be privatized.
       * @param {ccm.types.instance} instance - <i>ccm</i> instance
       * @param {...string} [properties] - properties that have to privatized, default: privatizes all not <i>ccm</i> relevant properties
       * @returns {object} object that contains the privatized properties and there values
       * @example
       * // privatize two public instance members
       * ccm.component( {
       *   name: 'dummy1',
       *   config: { foo: 'abc', bar: 'xyz', baz: 4711 },
       *   Instance: function () {
       *     var self = this;
       *     var my;
       *     this.ready = function ( callback ) {
       *       my = ccm.helper.privatize( self, 'foo', 'bar' );
       *       console.log( my );                // => { foo: 'abc', bar: 'xyz' }
       *       console.log( my.foo, self.foo );  // => 'abc' undefined
       *       console.log( my.bar, self.bar );  // => 'xyz' undefined
       *       console.log( my.baz, self.baz );  // => undefined 4711
       *       callback();
       *     };
       *   }
       * } );
       * @example
       * // privatize all possible public instance members
       * ccm.component( {
       *   name: 'dummy2',
       *   config: { foo: 'abc', bar: 'xyz', baz: 4711 },
       *   Instance: function () {
       *     var self = this;
       *     var my;
       *     this.ready = function ( callback ) {
       *       my = ccm.helper.privatize();
       *       console.log( my );                // => { foo: 'abc', bar: 'xyz', baz: 4711 }
       *       console.log( my.foo, self.foo );  // => 'abc' undefined
       *       console.log( my.bar, self.bar );  // => 'xyz' undefined
       *       console.log( my.baz, self.baz );  // => 4711 undefined
       *       callback();
       *     };
       *   }
       * } );
       */
      privatize: function ( instance, properties ) {

        var obj = {};
        if ( properties )
          for ( var i = 1; i < arguments.length; i++ )
            privatizeProperty( arguments[ i ] );
        else
          for ( var key in instance )
            privatizeProperty( key )
        return obj;

        function privatizeProperty( key ) {
          switch ( key ) {
            case 'ccm':
            case 'component':
            case 'element':
            case 'id':
            case 'index':
            case 'onfinish':
            case 'parent':
            case 'root':
              break;
            default:
              if ( self.helper.isInstance( instance[ key ] ) && instance[ key ].parent && instance[ key ].parent.index === instance.index ) return;
              if ( typeof instance[ key ] === 'function' ) return;
              if ( instance[ key ] !== undefined ) obj[ key ] = instance[ key ];
              delete instance[ key ];
          }
        }

      },

      protect: function ( value ) {

        if ( typeof value === 'string' ) {
          var tag = document.createElement( 'div' );
          tag.innerHTML = value;
          self.helper.makeIterable( tag.getElementsByTagName( 'script' ) ).map( function ( script ) {
            script.parentNode.removeChild( script );
          } );
          return tag.innerHTML;
        }

        if ( self.helper.isElementNode( value ) )
          self.helper.makeIterable( value.getElementsByTagName( 'script' ) ).map( function ( script ) {
            script.parentNode.removeChild( script );
          } );

        else if ( typeof value === 'object' && !self.helper.isNode( value ) )
          for ( var key in value )
            value[ key ] = self.helper.protect( value[ key ] );

        return value;

      },

      /**
       * @summary get a <i>ccm</i> relevant regular expression
       * @description
       * Possible index values, it's meanings and it's associated regular expressions:
       * <table>
       *   <tr>
       *     <th>index</th>
       *     <th>meaning</th>
       *     <th>regular expression</th>
       *   </tr>
       *   <tr>
       *     <td><code>'filename'</code></td>
       *     <td>filename for an <i>ccm</i> instance</td>
       *     <td>/^(ccm.)?([^.-]+)(-(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*))?(\.min)?(\.js)$/</td>
       *   </tr>
       *   <tr>
       *     <td><code>'key'</code></td>
       *     <td>key for a <i>ccm</i> dataset</td>
       *     <td>/^[a-z_0-9][a-zA-Z_0-9]*$/</td>
       *   </tr>
       * </table>
       * @param {string} index - index of the regular expression
       * @returns {RegExp} RegExp Object
       * @example
       * // test if a given string is a valid filename for an ccm instance
       * var string = 'ccm.dummy-3.2.1.min.js';
       * var result = ccm.helper.regex( 'filename' ).test( string );
       * console.log( result );  // => true
       * @example
       * // test if a given string is a valid key for a ccm dataset
       * var string = 'dummy12_Foo3';
       * var result = ccm.helper.regex( 'key' ).test( string );
       * console.log( result );  // => true
       */
      regex: function ( index ) {

        switch ( index ) {
          case 'filename': return /^ccm\.([a-z][a-z0-9_]*)(-(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*))?(\.min)?(\.js)$/;
          case 'key':      return /^[a-zA-Z_0-9]+$/;
        }

      },

      removeElement: function ( element ) {
        if ( element.parentNode ) element.parentNode.removeChild( element );
      },

      /**
       * @summary set the content of an HTML element
       * @param {ccm.types.element} element - HTML element
       * @param {string|ccm.types.element|ccm.types.element[]} content - HTML element or HTML string for content
       */
      setContent: function ( element, content ) {

        content = self.helper.protect( content );
        if ( typeof content === 'object' ) {
          element.innerHTML = '';
          if ( Array.isArray( content ) )
            content.map( function ( node ) { element.appendChild( node ); } );
          else
            element.appendChild( content );
        }
        else element.innerHTML = content;

      },

      show: function ( instance ) {
        instance.element.parentNode.removeChild( instance.element.parentNode.querySelector( '.ccm_loading' ) );
        instance.element.style.display = 'block';
      },

      /**
       * @summary shuffles an array (Durstenfeld shuffle)
       * @see http://en.wikipedia.org/wiki/Fisher-Yates_shuffle#The_modern_algorithm
       * @param {Array} array
       * @returns {Array}
       */
      shuffleArray: function ( array ) {
        for ( var i = array.length - 1; i > 0; i-- ) {
          var j = Math.floor( Math.random() * ( i + 1 ) );
          var temp = array[ i ];
          array[ i ] = array[ j ];
          array[ j ] = temp;
        }
        return array;
      },

      /**
       * @summary solves a <i>ccm</i> dependency
       * @param {object} obj - object that contains the <i>ccm</i> dependency
       * @param {number|string} key - object key that contains the <i>ccm</i> dependency
       * @param {function} [callback] - callback (first parameter is the result of the solved dependency)
       * @returns {*} result of the solved dependency (only ff synchron)
       * @example
       * var obj = { layout: [ ccm.load, 'style.css' ] };
       * ccm.helper.solveDependency( obj, 'layout', function ( result ) {
       *   console.log( result );  // => 'style.css'
       * } );
       */
      solveDependency: function ( obj, key, callback ) {

        // given object not contains a ccm dependency at the given key? => abort and perform callback without a result
        if ( !self.helper.isDependency( obj[ key ] ) ) { if ( callback ) callback(); return; }

        // determine ccm interface
        obj[ key ][ 0 ] = self[ obj[ key ][ 0 ].split( '.' ).pop() ];

        // add a callback to the ccm action data of the ccm dependency
        obj[ key ].push( function ( result ) {
          obj[ key ] = result;                  // replace ccm dependency with the result of the solved dependency
          if ( callback ) callback( result );
        } );

        // perform the ccm action data of the ccm dependency
        return self.helper.action( obj[ key ] );

      },

      transformStringArray: function ( arr ) {

        var obj = {};
        arr.map( function ( value ) { obj[ value ] = true } );
        return obj;

      },

      /**
       * @summary performs a function after a waiting time
       * @param {number} time - waiting time in milliseconds
       * @param {function} callback - performed function after waiting time
       * @example ccm.helper.wait( 1000, function () { console.log( 'I was called after 1 second' ) } );
       */
      wait: function ( time, callback ) {
        window.setTimeout( callback, time );
      }

    }

  };

  // set ccm version specific namespace
  if ( !ccm[ self.version() ] ) ccm[ self.version() ] = self;

  /*---------------------------------------------- private ccm methods -----------------------------------------------*/

  /**
   * @summary get ccm datastore source
   * @private
   * @param {ccm.types.settings} settings - ccm datastore settings
   * @returns {string}
   */
  function getSource( settings ) {

    /**
     * ccm datastore source
     * @type {string|number}
     */
    var source = JSON.stringify( self.helper.filterProperties( settings, 'url', 'db', 'store' ) );

    // source is empty object? => use unique number as source
    if ( source === '{}' ) source = Object.keys( stores ).length;

    return source;
  }

  /*---------------------------------------------- ccm type definitions ----------------------------------------------*/

  /**
   * @namespace ccm.types
   * @summary <i>ccm</i> type definitions
   */

  /**
   * @typedef {function|string|Array} ccm.types.action
   * @summary <i>ccm</i> action data
   * @example function() { ... }
   * @example functionName
   * @example 'functionName'
   * @example 'my.namespace.functionName'
   * @example ['my.namespace.functionName','param1','param2']
   */

  /**
   * @typedef {namespace} ccm.types.component
   * @summary <i>ccm</i> component object
   * @description Below you see typically (but not all mandatory) properties. Most of these properties are set by the <i>ccm</i> framework.
   * @property {ccm.types.index} index - <i>ccm</i> component index
   * @property {ccm.types.name} name - <i>ccm</i> component name
   * @property {ccm.types.version} version - <i>ccm</i> component version number
   * @property {ccm.types.config} config - default configuration for own <i>ccm</i> instances
   * @property {function} Instance - constructor for creating <i>ccm</i> instances out of this component
   * @property {function} init - callback when this component is registered
   * @property {function} instance - creates an <i>ccm</i> instance out of this component
   * @property {function} start - creates and starts an <i>ccm</i> instance
   * @property {number} instances - number of own created <i>ccm</i> instances
   * @example {
   *   index:     'chat-2.1.3',
   *   name:      'chat',
   *   version:   [ 2, 1, 3 ],
   *   config:    {...},
   *   Instance:  function () {...},
   *   init:      function ( callback ) { ...; callback(); },
   *   instance:  function ( config, callback ) {...},
   *   start:     function ( config, callback ) {...},
   *   instances: 0
   * }
   */

  /**
   * @typedef {object} ccm.types.config
   * @summary <i>ccm</i> instance configuration
   * @description Below you see typically (but not mandatory) properties.
   * @property {ccm.types.element} element - <i>ccm</i> instance website area
   * @property {ccm.types.dependency} html - <i>ccm</i> datastore for html templates
   * @property {ccm.types.dependency} style - CSS styles for own website area
   * @property {string} classes - html classes for own website area
   * @property {ccm.types.dependency} store - <i>ccm</i> datastore that contains the dataset for rendering
   * @property {ccm.types.key} key - key of dataset for rendering
   * @property {ccm.types.dependency} lang - <i>ccm</i> instance for multilingualism
   * @property {ccm.types.dependency} user - <i>ccm</i> instance for user authentication
   * @example {
   *   element: jQuery( '#container' ),
   *   html:    [ ccm.store, { local: 'templates.json' } ],
   *   style:   [ ccm.load, 'style.css' ],
   *   classes: 'ccm-chat_snow'
   *   store:   [ ccm.store, { url: 'ws://ccm2.inf.h-brs.de/index.js', store: 'chat' } ],
   *   key:     'test',
   *   lang:    [ ccm.instance, 'https://kaul.inf.h-brs.de/ccm/components/lang.js', {
   *     store: [ ccm.store, 'translations.json' ]
   *   } ],
   *   user:    [ ccm.instance, 'https://kaul.inf.h-brs.de/ccm/components/user.js' ]
   * }
   */

  /**
   * @typedef {object} ccm.types.dataset
   * @summary <i>ccm</i> dataset
   * @description
   * Every <i>ccm</i> dataset has a property 'key' which contains the unique key of the dataset.
   * There are no conventions for other properties. They can be as they want.
   * @example {
   *   "key": "demo",
   *   "text": "Hello, World!",
   *   "value": "4711"
   * }
   * @example {
   *   "key": "my_first_video_rating",
   *   "likes": {                       // users which clicks like button
   *     "akless": true,
   *     "hunny84": true
   *   },
   *   "dislikes": {                    // user which clicks dislike button
   *     "negativguy": true
   *   }
   * }
   * @example {
   *   "key": "fruit_game_settings",
   *   "max_player": 2,
   *   "fruits": [
   *     {
   *       "name": "Apple",
   *       "points": 50
   *     },
   *     {
   *       "name": "Pear",
   *       "points": 30
   *     }
   *   ]
   * }
   */

  /**
   * @typedef {Object.<ccm.types.key, ccm.types.dataset>} ccm.types.datasets
   * @summary collection of <i>ccm</i> datasets
   * @example {
   *   "demo": {
   *     "key": "demo",
   *     "text": "Hello, World!",
   *     "value": "4711"
   *   },
   *   "test": {
   *     "key": "test",
   *     "text": "My test dataset.",
   *     "value": "abc"
   *   }
   * }
   */

  /**
   * @summary callback when an delete operation is finished
   * @callback ccm.types.delResult
   * @param {ccm.types.dataset} result - deleted dataset
   * @example function () { console.log( result ); }
   */

  /**
   * @typedef {ccm.types.action} ccm.types.dependency
   * @summary <i>ccm</i> dependency
   * @example [ ccm.component, 'ccm.chat.js' ]
   * @example [ ccm.instance, 'ccm.chat.js' ]
   * @example [ ccm.start, 'ccm.chat.js' ]
   * @example [ ccm.load, 'style.css' ]
   * @example [ ccm.store, { local: 'datastore.json' } ]
   * @example [ ccm.get, { local: 'datastore.json' }, 'test' ]
   * @example [ ccm.set, { local: 'datastore.json' }, { key: 'test', foo: 'bar' } ]
   * @example [ ccm.del, { local: 'datastore.json' }, 'test' ]
   */

  /**
   * @typedef {object} ccm.types.element
   * @summary "jQuery Element" object
   * @description For more informations about jQuery see ({@link https://jquery.com}).
   * @example var element = jQuery( 'body' );
   * @example var element = jQuery( '#menu' );
   * @example var element = jQuery( '.entry' );
   */

  /**
   * @callback ccm.types.getResult
   * @summary callback when a read operation is finished
   * @param {ccm.types.dataset|ccm.types.dataset[]} result - requested dataset(s)
   * @example function ( result ) { console.log( result ) }
   */

  /**
   * @typedef {object} ccm.types.html
   * @summary <i>ccm</i> html data - TODO: explain properties of <i>ccm</i> html data
   * @ignore
   */

  /**
   * @typedef {string} ccm.types.index
   * @summary <i>ccm</i> component index (unique in <i>ccm</i> framework)
   * @description An <i>ccm</i> component index is made up of a [component name]{@link ccm.types.name} and its [version number]{@link ccm.types.version}.
   * @example "blank-1.0.0"
   * @example "chat-2.1.3"
   * @example "blank" // no version number means latest version
   * @example "chat"
   */

  /**
   * @typedef {object} ccm.types.instance
   * @summary <i>ccm</i> instance
   * @property {number} id - <i>ccm</i> instance id (unique in own component)
   * @property {string} index - <i>ccm</i> instance index (unique in <i>ccm</i> framework)<br>A <i>ccm</i> instance index is made up of own [component name]{@link ccm.types.name} and own [id]{@link ccm.types.instance} (example: <code>"chat-1"</code>).
   * @property {ccm.types.component} component - reference to associated <i>ccm</i> component
   * @property {function} init - callback when this <i>ccm</i> instance is created and before dependencies of dependent resources are solved
   * @property {function} ready - callback when all dependencies of dependent resources are solved
   * @property {function} start - start instance
   */

  /**
   * @typedef {object} ccm.types.JqXHR
   * @summary "jQuery XMLHttpRequest" object
   */

  /**
   * @typedef {string|number} ccm.types.key
   * @summary key of a <i>ccm</i> dataset (unique in the <i>ccm</i> datastore which contains the dataset)
   * @description Must be conform with the regular expression /^[a-z_0-9][a-zA-Z_0-9]*$/.
   * @example "test"
   * @example "_foo"
   * @example 4711
   * @example "1_ABC___4711"
   * @example "123"
   * @example "_"
   */

  /**
   * @typedef {string} ccm.types.name
   * @summary name of a <i>ccm</i> component (unique in a <i>ccm</i> component market place)
   * @description Must be conform with the regular expression /^[a-z][a-z_0-9]*$/.
   * @example "blank"
   * @example "chat"
   * @example "my_blank"
   * @example "chat2"
   * @example "bank_001"
   */

  /**
   * @typedef {object} ccm.types.node
   * @summary HTML node
   * @description For more informations see ({@link http://www.w3schools.com/jsref/dom_obj_all.asp}).
   */

  /**
   * @callback ccm.types.setResult
   * @summary callback when an create or update operation is finished
   * @param {ccm.types.dataset} result - created or updated dataset
   * @example function ( result ) { console.log( result ) }
   */

  /**
   * @typedef {object} ccm.types.settings
   * @summary <i>ccm</i> datastore settings
   * @description
   * Settings for a <i>ccm</i> datastore.
   * For more informations about providing a <i>ccm</i> datastore see the [documentation of the method 'ccm.store']{@link ccm.store}.
   * The data level in which the stored datasets will managed is dependent on the existing properties in the datastore settings.
   * No property 'store' results in a <i>ccm</i> datastore of data level 1.
   * An existing property 'store' results in a <i>ccm</i> datastore of data level 2.
   * An existing property 'store' and 'url' results in a <i>ccm</i> datastore of data level 3.
   * @property {ccm.types.datasets|ccm.types.url} local - Collection of initial <i>ccm</i> datasets or URL to a json file that deliver initial datasets for local cache.
   * See [this wiki page]{@link https://github.com/akless/ccm-developer/wiki/Data-Management#data-caching} for more informations about this kind of data caching.
   * @property {string} store - Name of the datastore in the database.
   * Dependent on the specific database the datastore has different designations.
   * For example in IndexedDB this is the name of the Object Store, in MongoDB the name of the Document Store and in MySQL the name of the Table.
   * This property is not relevant for the first data level. It is only relevant for higher data levels.
   * @property {string} url - URL to an <i>ccm</i> compatible server interface.
   * This property is only relevant for the third data level.
   * See [this wiki page]{@link https://github.com/akless/ccm-developer/wiki/Data-Management#server-interface} for more informations about an <i>ccm</i> compatible server interface.
   * @property {string} db - database (in case of a server that offers more than one database)
   * @property {function} onchange - Callback when server informs about changed stored datasets.
   * This property is only relevant for the third data level with real-time communication.
   * See [this wiki page]{@link https://github.com/akless/ccm-developer/wiki/Data-Management#real-time-communication} for more informations.
   * @property {ccm.types.instance} user - <i>ccm</i> instance for user authentication (not documented yet) | TODO: Wiki page for datastore security
   * @example
   * // provides a empty ccm datastore of data level 1
   * {}
   * @example
   * // provides a ccm datastore of data level 1 with initial datasets from a JSON file
   * {
   *   local: 'templates.json'
   * }
   * @example
   * // same example but cross domain
   * {
   *   local: 'http://akless.github.io/ccm-developer/resources/chat/templates.json'
   * }
   * // cross domain only works if json file looks like this: ccm.callback[ 'templates.json' ]( {...} );
   * @example
   * // provides a ccm datastore of data level 1 with directly given initial datasets
   * {
   *   local: {
   *     "demo": {
   *       "key": "demo",
   *       "text": "Hello, World!",
   *       "value": "4711"
   *     },
   *     "test": {
   *       "key": "test",
   *       "text": "My test dataset.",
   *       "value": "abc"
   *     }
   *   }
   * }
   * @example
   * // provides a ccm datastore of data level 2
   * {
   *   store: 'chat'
   * }
   * @example
   * // provides a ccm datastore of data level 3 using HTTP
   * {
   *   store: 'chat',                              // The file interface.php must be
   *   url: 'http://path/to/server/interface.php'  // an ccm compatible server interface
   * }
   * @example
   * // provides a ccm realtime datastore of data level 3 using WebSocket
   * {
   *   store: 'chat',                              // The file interface.php must be
   *   url: 'ws://path/to/server/interface.php',   // an ccm compatible server interface
   *   onchange: function () {
   *     console.log( arguments );  // Shows the server informations about changed
   *   }                            // stored datasets in the developer console.
   * }
   */

  /**
   * @typedef {string|object} ccm.types.source
   * @summary <i>ccm</i> datastore source - TODO: explain forms of <i>ccm</i> datasstore sources
   * @ignore
   */

  /**
   * @callback ccm.types.storeResult
   * @summary callback when a provided datastore is ready for use
   * @param {ccm.Datastore} store - <i>ccm<i/> datastore
   * @example function ( store ) { console.log( store ) }
   */

  /**
   * @typedef {string} ccm.types.url
   * @summary Uniform Resource Locator (URL)
   * @example https://github.com/akless/ccm-developer
   * @example ws://ccm2.inf.h-brs.de/index.js:80
   * @example http://akless.github.io/ccm-developer/resources/ccm.chat.min.js
   */

  /**
   * @typedef {string} ccm.types.version
   * @summary version number conform with Semantic Versioning 2.0.0 ({@link http://semver.org})
   * @example '1.0.0'
   * @example '2.1.3'
   */

} )();