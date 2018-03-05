/**
 * @overview ccm framework
 * @author André Kless <andre.kless@web.de> 2014-2018
 * @license The MIT License (MIT)
 * @version 16.0.0
 * @changes
 * version 16.0.0 (05.03.2018): update service for ccm data management
 * - uses ES6 syntax
 * - no caching on higher data levels
 * - datastore settings are not optional
 * - code refactoring
 * - working with datastores is always with callbacks (no return values)
 * - only data dependencies are solved in results of store.get() calls
 * - result of store.set() and store.del() calls is TRUE on success (not the dataset)
 * - datastore objects have a 'parent' property (they are now part of ccm contexts)
 * - user token from the highest ccm user instance is automatically passed on data operations (get, set, del)
 * - queries and datastore settings passed as parameters will be cloned
 * - add ccm.helper.log(*) -> logs a ccm-specific message in the browser console
 * - error messages from a data server and invalid dataset keys are logged in the browser console
 * - add ccm.helper.isResourceDataObject(*):boolean -> checks if a value is an resource data object
 * - add ccm.helper.isKey(*):boolean -> checks if a value is a valid ccm dataset key
 * - character '-' is allowed in ccm dataset keys
 * - add ccm.helper.isDatastoreSettings(*):boolean -> checks if the value is datastore settings
 * - ccm.helper.onfinish uses highest ccm user instance
 * (for older version changes see ccm-15.0.2.js)
 */

( function () {

  /**
   * contains the already loaded resources
   * @type {Object}
   * @example
   * // example of a cache containing two resources already loaded
   * {
   *   'https://akless.github.io/ccm/unit_tests/dummy/hello.html': "Hello, <b>World</b>!",
   *   'https://akless.github.io/ccm/unit_tests/dummy/script.js': { foo: 'bar' }
   * }
   */
  let cache = {};

  /**
   * registered ccm component objects
   * @type {Object.<ccm.types.index, ccm.types.component>}
   */
  const components = {};

  /**
   * for creating ccm datastores
   * @lends ccm.Datastore
   * @constructor
   */
  const Datastore = function () {

    /**
     * websocket communication callbacks
     * @type {function[]}
     */
    const callbacks = [];

    /**
     * own reference for inner functions
     * @type {ccm.Datastore}
     */
    const that = this;

    /**
     * privatized instance members
     * @type {Object}
     */
    let my;

    /**
     * is called once after for the initialization and is then deleted
     * @param {function} callback - when datastore is initialized
     */
    this.init = callback => {

      // privatize security relevant members
      my = self.helper.privatize( that, 'local', 'store', 'url', 'db', 'method', 'datasets' );

      // prepare IndexedDB if necessary
      my.store && !my.url ? prepareDB( proceed ) : proceed();

      /**
       * prepares the ccm database in the IndexedDB
       * @param {function} callback
       */
      function prepareDB( callback ) {

        // open ccm database if necessary
        !db ? openDB( proceed ) : proceed();

        /**
         * open ccm database
         * @param {function} callback
         */
        function openDB( callback ) {

          /**
           * the request for opening the ccm database
           * @type {Object}
           */
          const request = indexedDB.open( 'ccm' );

          // set success callback
          request.onsuccess = function () {

            // set database object
            db = this.result;

            // perform callback
            callback();

          };

        }

        function proceed() {

          // needed object store in IndexedDB not exists? => update ccm database
          !db.objectStoreNames.contains( my.store ) ? updateDB( callback ) : callback();

          /**
           * updates the ccm database
           * @param {function} callback
           */
          function updateDB( callback ) {

            /**
             * current ccm database version number
             * @type {number}
             */
            let version = parseInt( localStorage.getItem( 'ccm' ) );

            // no version number? => start with 1
            if ( !version ) version = 1;

            // close ccm database
            db.close();

            /**
             * request for reopening ccm database
             * @type {Object}
             */
            const request = indexedDB.open( 'ccm', version + 1 );

            // set callback for event when update is needed
            request.onupgradeneeded = () => {

              // set database object
              db = this.result;

              // save new ccm database version number in local storage
              localStorage.setItem( 'ccm', db.version );

              // create new object store
              db.createObjectStore( my.store, { keyPath: 'key' } );

            };

            // set success callback => perform callback
            request.onsuccess = callback;

          }

        }

      }

      function proceed() {

        // is ccm realtime datastore?
        my.url && my.url.indexOf( 'ws' ) === 0 ? prepareRealtime( callback ) : callback();

        /**
         * prepares the realtime functionality
         * @param {function} callback
         */
        function prepareRealtime( callback ) {

          // prepare initial message
          let message = [ my.db, my.store ];
          if ( my.datasets )
            message = message.concat( my.datasets );

          // connect to server
          my.socket = new WebSocket( my.url, 'ccm' );

          // set server notification callback
          my.socket.onmessage = message => {

            // parse server message to JSON
            message = JSON.parse( message.data );

            // own request? => perform callback
            if ( message.callback ) callbacks[ message.callback - 1 ]( message.data );

            // notification about changed data from other client?
            else {

              // change data locally
              const dataset = ( self.helper.isObject( message ) ? updateLocal : delLocal )( message );

              // perform change callback
              that.onchange && that.onchange( dataset );

            }

          };

          // send initial message
          my.socket.onopen = function () { this.send( message ); callback(); };

        }
      }

    };

    /**
     * returns the source of the datastore
     * @returns {Object} datastore source
     */
    this.source = () => self.helper.filterProperties( my, 'url', 'db', 'store' );

    /** clears the local cache */
    this.clear = () => my.local = {};

    /**
     * requests one or more datasets
     * @param {ccm.types.key|Object} [key_or_query={}] - unique key of the dataset or alternative a query (default: query all datasets)
     * @param {function} [callback] - when operation is finished (result is passed as first parameter)
     */
    this.get = ( key_or_query={}, callback ) => {

      // first parameter is skippable
      if ( typeof key_or_query === 'function' ) { callback = key_or_query; key_or_query = {}; }

      // was a query passed? => clone query
      if ( self.helper.isObject( key_or_query ) ) key_or_query = self.helper.clone( key_or_query );

      // has an invalid key been passed? => abort and perform callback without a result
      else if ( !self.helper.isKey( key_or_query ) ) return null;

      // detect managed data level
      my.url ? serverDB() : ( my.store ? clientDB() : localCache() );

      /** requests dataset(s) from local cache */
      function localCache() {

        solveDependencies( self.helper.isObject( key_or_query ) ? runQuery( key_or_query ) : self.helper.clone( my.local[ key_or_query ] ), callback );

        /**
         * finds datasets in local cache by query
         * @param {Object} query
         * @returns {ccm.types.dataset[]}
         */
        function runQuery( query ) {

          /**
           * found datasets
           * @type {ccm.types.dataset[]}
           */
          const results = [];

          // find the datasets in the local cache that satisfy the query
          for ( const key in my.local ) self.helper.isSubset( query, my.local[ key ] ) && results.push( self.helper.clone( my.local[ key ] ) );

          return results;
        }

      }

      /** requests dataset(s) from client-side database */
      function clientDB() {

        getStore().get( key_or_query ).onsuccess = event => solveDependencies( event.target.result, callback );

      }

      /** requests dataset(s) from server-side database */
      function serverDB() {

        ( my.socket ? useWebsocket : useHttp )( prepareParams( { key: key_or_query } ), response => !checkResponse( response ) && solveDependencies( response, callback ) );

      }

      /**
       * solves all ccm data dependencies inside an object
       * @param {Object} obj - object
       * @param {function} callback - when all data dependencies are solved (first parameter is the object)
       */
      function solveDependencies( obj, callback ) {

        // no object passed? => abort and perform callback with NULL
        if ( !self.helper.isObject( obj ) ) return callback( null );

        /**
         * unfinished asynchronous operations
         * @type {number}
         */
        let counter = 1;

        recursive( obj );

        function recursive( arr_or_obj ) {

          // iterate over object/array
          for ( const i in arr_or_obj ) {

            // is a data dependency? => solve it
            if ( Array.isArray( arr_or_obj[ i ] && arr_or_obj[ i ].length > 0 && arr_or_obj[ i ][ 0 ] === 'ccm.get' ) ) solveDependency( arr_or_obj[ i ], arr_or_obj, i );

            // is an array or object? => search it recursively
            else if ( Array.isArray( arr_or_obj[ i ] ) || self.helper.isObject( arr_or_obj[ i ] ) ) recursive( arr_or_obj[ i ] );

          }

          // check if all data dependencies are solved (in case none exist)
          check();

        }

        /**
         * solves a ccm data dependency
         * @param {ccm.types.action} dependency - data dependency
         * @param {Array|Object} arr_or_obj - array or object that contains the data dependency
         * @param {string|number} i - index/key in the array/object containing the data dependency
         */
        function solveDependency( dependency, arr_or_obj, i ) {

          // start of a new asynchronous operation
          counter++;

          // solve dependency, search result recursively and check if all data dependencies are solved
          self.get( dependency[ 1 ], dependency[ 2 ], result => { arr_or_obj[ i ] = result; recursive( result ); check(); } );

        }

        /** checks if all data dependencies are resolved and calls the callback, if so */
        function check() {

          !--counter && callback && callback( obj );

        }

      }

    };

    /**
     * creates or updates a dataset
     * @param {Object} priodata - priority data
     * @param {function} [callback]
     */
    this.set = ( priodata, callback ) => {

      // clone priority data
      priodata = self.helper.clone( priodata );

      // priority data has no key? => generate unique key
      if ( !priodata.key ) priodata.key = self.helper.generateKey();

      // priority data does not contain a valid key? => abort
      if ( !self.helper.isKey( priodata.key ) ) return;

      // detect managed data level
      my.url ? serverDB() : ( my.store ? clientDB() : localCache() );

      /** creates/updates dataset in local cache */
      function localCache() {

        // does the dataset already exist? => update it
        if ( my.local[ priodata.key ] ) self.helper.integrate( priodata, my.local[ priodata.key ] );

        // dataset not exist? => create it
        else my.local[ priodata.key ] = priodata;

        // perform callback
        callback && callback();

      }

      /** creates/updates dataset in client-side database */
      function clientDB() {

        getStore().put( priodata ).onsuccess = event => callback && callback( !!event.target.result );

      }

      /**
       * creates/updates dataset in server-side database
       * @returns {ccm.types.dataset} created or updated dataset
       */
      function serverDB() {

        ( my.socket ? useWebsocket : useHttp )( prepareParams( { dataset: priodata } ), response => !checkResponse( response ) && response === true && callback && callback() );

      }

    };

    /**
     * deletes a dataset
     * @param {ccm.types.key} key - dataset key
     * @param {function} [callback]
     */
    this.del = ( key, callback ) => {

      // invalid key? => abort
      if ( !self.helper.isKey( key ) ) return;

      // detect managed data level
      my.url ? serverDB() : ( my.store ? clientDB() : localCache() );

      /** deletes dataset in local cache */
      function localCache() {

        delete my.local[ key ]; callback && callback( true );

      }

      /** deletes dataset in client-side database */
      function clientDB() {

        getStore().delete( key ).onsuccess = event => callback && callback( !!event.target.result );

      }

      /** deletes dataset in server-side database */
      function serverDB() {

        ( my.socket ? useWebsocket : useHttp )( prepareParams( { del: key } ), response => !checkResponse( response ) && response === true && callback && callback() );

      }

    };

    /**
     * gets the object store from IndexedDB
     * @returns {Object}
     */
    function getStore() {

      return db.transaction( [ my.store ], 'readwrite' ).objectStore( my.store );

    }

    /**
     * prepares HTTP parameters
     * @param {Object} [params] - individual HTTP parameters
     * @returns {Object} complete HTTP parameters
     */
    function prepareParams( params={} ) {

      if ( my.db ) params.db = my.db;
      params.store = my.store;
      const user = self.context.find( that, 'user' );
      if ( user && user.isLoggedIn() ) params.token = user.data().token;
      return params;

    }

    /**
     * sends HTTP parameters to server interface via websocket connection
     * @param {Object} params - HTTP parameters
     * @param {function} callback - callback for server response
     */
    function useWebsocket( params, callback ) {

      callbacks.push( callback );
      params.callback = callbacks.length;
      my.socket.send( JSON.stringify( params ) );

    }

    /**
     * sends HTTP parameters to server interface via HTTP request
     * @param {Object} params - HTTP parameters
     * @param {function} callback - callback for server response
     */
    function useHttp( params, callback ) {

      self.load( { url: my.url, params: params, method: my.method }, callback );

    }

    /**
     * checks server response
     * @param {*} [response] - server response
     * @returns {boolean} recommendation to abort processing
     */
    function checkResponse( response ) {

      return typeof response === 'string' ? !self.helper.log( 'Server', my.url, 'has sent an error message:', response ) : false;

    }

  };

  /**
   * ccm database in IndexedDB
   * @type {Object}
   */
  let db;

  /**
   * @summary Contains the waiting lists of the resources being loaded.
   * @description A wait list contains the ccm.load calls that will be run again after the resource is loaded.
   * @type {Object.<string,ccm.types.action[]>}
   * @example
   * // example of a wait list for the resource "style.css" for which two ccm.load calls are waiting
   * {
   *   'https://akless.github.io/ccm/unit_tests/dummy/style.css': [
   *     [ ccm.load,
   *       'https://akless.github.io/ccm/unit_tests/dummy/style.css',
   *       'https://akless.github.io/ccm/unit_tests/dummy/hello.html'
   *     ],
   *     [ ccm.load,
   *       'https://akless.github.io/ccm/unit_tests/dummy/script.js',
   *       'https://akless.github.io/ccm/unit_tests/dummy/style.css'
   *     ]
   *   ]
   * }
   */
  const waiting_lists = {};

  /*--------------------------------------------- public ccm namespaces ----------------------------------------------*/

  // set global ccm namespace
  if ( !window.ccm ) ccm = {

    /**
     * global namespaces for the registered ccm components
     * @type {Object.<ccm.types.index, object>}
     */
    components: {},

    /**
     * callbacks for cross domain data exchanges via ccm.load
     * @type {Object.<string, function>}
     */
    callbacks: {},

    /**
     * globally stored data of the JavaScript files downloaded via ccm.load
     * @type {Object}
     */
    files: {}

  };

  /**
   * global ccm object of the framework
   * @type {Object}
   */
  const self = {

    /**
     * version number of the framework
     * @returns {ccm.types.version}
     */
    version: () => '16.0.0',

    /** clears the cache of already loaded resources */
    clear: () => { cache = {}; },

    /**
     * asynchronous loading of resources
     * @see https://github.com/akless/ccm/wiki/Loading-of-Resources
     * @param {...ccm.types.resource} resources - resources data
     * @param {function} [callback] - when all resources are loaded (first parameter are the results)
     * @returns {*} result(s) of the ccm.load call (only if no asynchronous operations were required)
     */
    load: function () {

      /**
       * arguments of this ccm.load call
       * @type {Array}
       */
      const args = [ ...arguments ];

      /**
       * current ccm.load call
       * @type {ccm.types.action}
       */
      const call = args.slice( 0 ); call.unshift( self.load );

      /**
       * result(s) of this ccm.load call
       * @type {*}
       */
      let results = [];

      /**
       * indicates if this ccm.load call is waiting for resources being loaded
       * @type {boolean}
       */
      let waiting = false;

      /**
       * number of resources being loaded
       * @type {number}
       */
      let counter = 1;

      /**
       * when all resources have been loaded
       * @type {function}
       */
      const callback = typeof args[ args.length - 1 ] === 'function' ? args.pop() : null;

      // iterate over resources data => load resource
      args.map( ( resource, i ) => {

        // increase number of resources being loaded
        counter++;

        // no manipulation of passed original parameters
        resource = self.helper.clone( resource );

        // resource data is an array? => load resources serially
        if ( Array.isArray( resource ) ) { results[ i ] = []; serial( null ); return; }

        // has resource URL instead of resource data? => use resource data which contains only the URL information
        if ( !self.helper.isObject( resource ) ) resource = { url: resource };

        /**
         * file extension from the URL of the resource
         * @type {string}
         */
        const suffix = resource.url.split( '.' ).pop().toLowerCase();

        // no given resource context or context is 'head'? => load resource in global <head> context (no Shadow DOM)
        if ( !resource.context || resource.context === 'head' ) resource.context = document.head;

        // given resource context is a ccm instance? => load resource in the shadow root context of that instance
        if ( self.helper.isInstance( resource.context ) ) resource.context = resource.context.element.parentNode;

        // determine the operation for loading the resource
        const operation = getOperation();

        // loading of CSS, but not in the global <head>? => ignore cache (to support loading the same CSS file in different contexts)
        if ( operation === loadCSS && resource.context !== document.head ) resource.ignore_cache = true;

        // by default, no caching for loading data
        if ( operation === loadData && resource.ignore_cache === undefined ) resource.ignore_cache = true;

        // avoid loading a resource twice
        if ( caching() ) return;

        // is the resource loaded for the first time? => mark the resource as "loading" in the cache
        if ( cache[ resource.url ] === undefined ) cache[ resource.url ] = null;

        // start loading of the resource
        operation();

        /**
         * loads resources serially (recursive function)
         * @param {*} result - result of the last serially loaded resource (is null on the first call)
         */
        function serial( result ) {

          // not the first call? => add result of the last call
          if ( result !== null ) results[ i ].push( result );

          // are there any more resources to load serially?
          if ( resource.length > 0 ) {

            /**
             * next resource to be serially loaded
             * @type {ccm.types.resource}
             */
            const next = resource.shift();

            // next resource is an array of resources? => load these resources in parallel (recursive call of ccm.load)
            if ( Array.isArray( next ) ) { next.push( serial ); self.load.apply( null, next ); }

            // normal resource data is given for the next resource => load the next resource serially (recursive call of ccm.load and this function)
            else self.load( next, serial );

          }
          // serially loading of resources completed => check if all resources of this ccm.load call are loaded
          else check();

        }

        /**
         * determines the operation for loading the resource
         * @returns {function}
         */
        function getOperation() {

          switch ( resource.type ) {
            case 'css':   return loadCSS;
            case 'image': return loadImage;
            case 'data':  return loadData;
            case 'js':    return loadJS;
          }

          switch ( suffix ) {
            case 'css':
              return loadCSS;
            case 'jpg':
            case 'jpeg':
            case 'gif':
            case 'png':
            case 'svg':
            case 'bmp':
              return loadImage;
            case 'js':
              return loadJS;
            default:
              return loadData;
          }

        }

        /**
         * avoids loading a resource twice
         * @returns {boolean} resource does not need to be reloaded
         */
        function caching() {

          // no caching for this resource? => resource must be loaded (unless this ccm.load call is already waiting for a resource)
          if ( resource.ignore_cache ) return waiting;

          // is the resource already loading?
          if ( cache[ resource.url ] === null ) {

            // is this ccm.load call already waiting? => abort this ccm.load call (counter will not decrement)
            if ( waiting ) return true;

            // mark this ccm.load call as waiting
            waiting = true;

            // is there no waiting list for this resource yet? => create waitlist
            if ( !waiting_lists[ resource.url ] ) waiting_lists[ resource.url ] = [];

            // put this ccm.load call on the waiting list for this resource
            waiting_lists[ resource.url ].push( call );

            // abort this ccm.load call (counter will not decrement)
            return true;

          }

          // has the resource already been loaded?
          if ( cache[ resource.url ] !== undefined ) {

            // the result is the already cached value for this resource
            results[ i ] = cache[ resource.url ];

            // resource does not need to be reloaded
            success(); return true;

          }

          // resource must be loaded
          return false;

        }

        /** loads (and executes) a CSS file */
        function loadCSS() {

          // load the CSS file via a <link> element
          let element = { tag: 'link', rel: 'stylesheet', type: 'text/css', href: resource.url };
          if ( resource.attr ) self.helper.integrate( resource.attr, element );
          element = self.helper.html( element );
          resource.context.appendChild( element );
          element.onload = success;

        }

        /** (pre)loads an image file */
        function loadImage() {

          // (pre)load the image file via an image object
          const image = new Image();
          image.onload = success;
          image.src = resource.url;

        }

        /** loads (and executes) a JavaScript file */
        function loadJS() {

          /**
           * filename of the JavaScript file (without '.min')
           * @type {string}
           */
          const filename = resource.url.split( '/' ).pop().replace( '.min.', '.' );

          // mark JavaScript file as loading
          ccm.files[ filename ] = null;

          // load the JavaScript file via a <script> element
          let element = { tag: 'script', src: resource.url };
          if ( resource.attr ) self.helper.integrate( resource.attr, element );
          element = self.helper.html( element );
          resource.context.appendChild( element );
          element.onload = () => {

            /**
             * data globally stored by the loaded JavaScript file
             * @type {*}
             */
            const data = ccm.files[ filename ];

            // remove the stored data from the global context
            delete ccm.files[ filename ];

            // perform success callback
            if ( data !== null ) successData( data ); else success();

          };

        }

        /** performs a data exchange */
        function loadData() {

          // no HTTP method set? => use 'GET'
          if ( !resource.method ) resource.method = 'GET';

          // should JSONP be used? => load data via JSONP, otherwise via AJAX request
          if ( resource.method === 'JSONP' ) jsonp(); else ajax();

          /** performs a data exchange via JSONP */
          function jsonp() {

            // prepare callback function
            const callback = 'callback' + self.helper.generateKey();
            if ( !resource.params ) resource.params = {};
            resource.params.callback = 'ccm.callbacks.' + callback;
            ccm.callbacks[ callback ] = data => {
              resource.context.removeChild( element );
              delete ccm.callbacks[ callback ];
              successData( data );
            };

            // prepare the <script> element for data exchange
            let element = { tag: 'script', src: buildURL( resource.url, resource.params ) };
            if ( resource.attr ) self.helper.integrate( resource.attr, element );
            element = self.helper.html( element );
            element.src = element.src.replace( /&amp;/g, '&' );  // TODO: Why is this "&amp;" happening in ccm.helper.html?

            // start the data exchange
            resource.context.appendChild( element );

          }

          /** performs an AJAX request */
          function ajax() {
            const request = new XMLHttpRequest();
            request.open( resource.method, resource.method === 'GET' ? buildURL( resource.url, resource.params ) : resource.url, true );
            request.onreadystatechange = () => {
              if( request.readyState === 4 && request.status === 200 )
                successData( self.helper.regex( 'json' ).test( request.responseText ) ? JSON.parse( request.responseText ) : request.responseText );
            };
            request.send( resource.method === 'POST' ? JSON.stringify( resource.params ) : undefined );
          }

          /**
           * adds the parameters in the URL
           * @param {string} url - URL
           * @param {Object} data - HTTP parameters
           * @returns {string} finished URL
           */
          function buildURL( url, data ) {
            return data ? url + '?' + params( data ).slice( 0, -1 ) : url;
            function params( obj, prefix ) {
              let result = '';
              for ( const i in obj ) {
                const key = prefix ? prefix + '[' + encodeURIComponent( i ) + ']' : encodeURIComponent( i );
                if ( typeof( obj[ i ] ) === 'object' )
                  result += params( obj[ i ], key );
                else
                  result += key + '=' + encodeURIComponent( obj[ i ] ) + '&';
              }
              return result;
            }

          }

        }

        /**
         * when a data exchange has been completed successfully
         * @param {*} data - received data
         */
        function successData( data ) {

          // received data is a JSON string? => parse it to JSON
          if ( typeof data === 'string' && ( data.charAt( 0 ) === '[' || data.charAt( 0 ) === '{' ) ) data = JSON.parse( data );

          // add received data to the results of the ccm.load call and to the cache
          results[ i ] = cache[ resource.url ] = self.helper.protect( data );

          // perform success callback
          success();

        }

        /** when a resource is loaded successfully */
        function success() {

          // is there no result value yet? => use the URL as the result of the ccm.load call and the cache
          if ( results[ i ] === undefined ) results[ i ] = cache[ resource.url ] = resource.url;

          // is there a waiting list for the loaded resource? => perform waiting ccm.load calls
          if ( waiting_lists[ resource.url ] )
            while ( waiting_lists[ resource.url ].length > 0 )
              self.helper.action( waiting_lists[ resource.url ].shift() );

          // check if all resources are loaded
          check();

        }

      } );

      // check if all resources are loaded (important if all resources are already loaded)
      return check();

      /**
       * checks if all resources are loaded
       * @returns {*} result of this ccm.load call
       */
      function check() {

        // decrease number of resources being loaded
        counter--;

        // are all resources loaded now?
        if ( counter === 0 ) {

          // only one result? => do not use a field
          if ( results.length <= 1 ) results = results[ 0 ];

          // finish this ccm.load call
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
     * @returns {boolean} true if component is registered
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
        if ( component.indexOf( '.js' ) === -1 ) proceed( components[ component ] );

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
      else proceed( component );

      // check and return if component is already registered
      return typeof component === 'string' && component.indexOf( '.js' ) === -1 && components[ component ] && true;

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
        if ( !( 'customElements' in window ) ) self.load( {
          url: 'https://cdnjs.cloudflare.com/ajax/libs/webcomponentsjs/1.0.14/webcomponents-lite.js',
          integrity: 'sha384-TTXH4zkR6Kx22xssZjsMANEJr+byWdSVr/CwNZyegnManSjJsugFZC/SJzGWARHw',
          crossorigin: 'anonymous'
        }, proceed ); else return proceed();

        function proceed() {

          // get framework version
          var version = getFrameworkVersion();

          // load needed ccm framework version if not already there
          if ( !ccm[ version ] ) self.load( component.ccm, proceed ); else proceed();

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

              component.instances = 0;         // add ccm instance counter
              component.ccm = ccm[ version ];  // add ccm framework reference

              // add function for creating and starting ccm instances
              component.instance = function ( config, callback ) { return self.instance( component.index, config, callback ); };
              component.start    = function ( config, callback ) { return self.start   ( component.index, config, callback ); };

              // set default of default ccm instance configuration
              if ( !component.config ) component.config = {};

              // set ccm framework reference for instances
              component.config.ccm = component.ccm;

            }

            /**
             * defines ccm Custom Element for component
             */
            function defineCustomElement() {

              var name = 'ccm-' + component.index;
              if ( customElements.get( name ) ) return;
              window.customElements.define( name, class extends HTMLElement {
                connectedCallback() {
                  var _this = this;
                  self.helper.wait( 1, function () {
                    if ( !document.body.contains( _this ) ) return;
                    var node = _this;
                    while ( node = node.parentNode )
                      if ( node.tagName && node.tagName.indexOf( 'CCM-' ) === 0 )
                        return;
                    var config = self.helper.generateConfig( _this );
                    config.root = _this;
                    component.start( config );
                  } );
                }
              } );

            }

          }

          /**
           * get version number from component used framework URL
           * @returns {string}
           */
          function getFrameworkVersion() {

            // only framework URL? => convert to object
            if ( typeof component.ccm === 'string' ) component.ccm = { url: component.ccm };

            // determine component used framework version number (with framework URL)
            var version = component.ccm.url.split( '/' ).pop().split( '-' );
            if ( version.length > 1 ) {
              version = version[ 1 ].split( '.' );
              version.pop();
              if ( version[ version.length - 1 ] === 'min' ) version.pop();
              version = version.join( '.' );
            }
            else version = 'latest';

            return version;

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
       * @param {boolean} [start] - start created instance
       * @returns {ccm.types.instance} created instance (only if synchron)
       */
      function recursive( comp, cfg, prev_cfg, prev_key, parent, start ) {

        // increase number of loading resources
        counter++;

        // remember own dependency
        var dependency = [ 'ccm.instance', arguments[ 0 ], self.helper.clone( cfg ) ];

        // make sure that the component is registered and get it's component index
        self.component( comp, function ( comp ) { proceed( comp.index ); } );

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
            else proceed( cfg );
          }
          else return proceed( cfg );
          function integrate( dataset ) {
            self.helper.integrate( cfg, dataset );
            delete dataset.key;
            return proceed( dataset );
          }

          function proceed( cfg ) {

            // instance is faster than component? => wait a moment
            if ( components[ index ].instances === undefined ) return ccm.helper.wait( 500, function () { proceed( cfg ); } );

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
            if ( cfg ) {
              self.helper.privatize( cfg, 'ccm', 'component', 'element', 'id', 'index', 'init', 'key', 'ready', 'start' );
              self.helper.integrate( cfg, instance );           // integrate ccm instance configuration
            }
            instance.id = components[ index ].instances;        // set ccm instance id
            instance.index = index + '-' + instance.id;         // set ccm instance index
            instance.component = components[ index ];           // set ccm component reference
            var root;
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

            // check if all dependencies are solved | TODO: correct timed instance.start() call
            if ( start ) instance.start( function () { check(); } ); else return check();

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
              //if ( !instance.root.parentNode ) document.head.appendChild( instance.root );

              // create element for shadow root
              var shadow = document.createElement( 'div' );
              shadow.id = 'ccm-' + instance.index;
              root = document.createElement( 'div' );
              self.helper.setContent( root, shadow );
              document.head.appendChild( root );

              // prepare website area for ccm instance
              var element = self.helper.html( { id: 'element' } );

              // create shadow DOM
              shadow = shadow.attachShadow( { mode: 'open' } );
              shadow.appendChild( element );

              // prepared website area is website area for created instance
              instance.element = element;

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

                  case 'ccm.module':
                    counter++;
                    const callback = 'callback' + self.helper.generateKey();
                    ccm.callbacks[ callback ] = function ( result ) {
                      delete ccm.callbacks[ callback ];
                      self.helper.removeElement( tag );
                      setResult( result );
                    };
                    const tag = self.helper.html( { tag: 'script', type: 'module' } );
                    tag.text = "import * as obj from '"+action[1]+"'; ccm.callbacks['"+callback+"']( obj )";
                    document.head.appendChild( tag );
                    break;

                  case 'ccm.component':
                    counter++;
                    if ( !action[ 2 ] ) action[ 2 ] = {};
                    action[ 2 ].parent = instance;
                    self.component( action[ 1 ], action[ 2 ], function ( result ) { setResult( result ); } );
                    break;

                  case 'ccm.instance':
                  case 'ccm.start':
                    waiter.push( [ recursive, action[ 1 ], action[ 2 ], instance_or_array, key, instance, action[ 0 ] === 'ccm.start' ] );
                    break;

                  case 'ccm.proxy':
                    proxy( action[ 1 ], action[ 2 ], instance_or_array, key, instance );
                    break;

                  case 'ccm.store':
                    counter++;
                    action[ 2 ].parent = instance;
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
                    if ( Array.isArray( resources[ i ] ) ) { setContext( resources[ i ] ); continue; }
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

                self.helper.setContent( instance.root, root.firstElementChild );
                document.head.removeChild( root );

                // waitlist not empty? => continue with waiting unsolved dependencies
                if ( waiter.length > 0 ) return self.helper.action( waiter.shift() );  // recursive call

                // each instance knows her own dependency
                instance.dependency = dependency;

                // initialize created instances (start recursive with result instance)
                initialize( result, function () {

                  // root element is a child of <head>? => remove it from <head> (but keep reference)
                  //if ( result.root.parentNode === document.head ) document.head.removeChild( result.root );

                  // perform callback with result instance
                  if ( callback ) callback( result );

                } );

              }

              // return result instance (only synchron)
              return counter === 0 ? result : null;

            }

            /**
             * initialize ccm instance and all its dependent ccm instances (recursive)
             * @param {ccm.types.instance|object|Array} instance - ccm instance or inner object or array
             * @param {function} callback
             */
            function initialize( instance, callback ) {

              /**
               * founded ccm instances
               * @type {Array.<ccm.types.instance>}
               */
              var results = [ instance ];

              // find all ccm instances
              find( instance );

              // see order of results
              //console.log( 'ccm#initialize', instance.index, results.map( function ( result ) { return result.index } ) );

              // initialize all founded ccm instances
              var i = 0; init();

              /**
               * find all ccm instances (breadth-first-order, recursive)
               * @param {Object} obj - object
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

                // add founded inner ccm instances to results
                inner.map( function ( obj ) { if ( self.helper.isInstance( obj ) ) results.push( obj ); } );

                // go deeper (recursive calls)
                inner.map( function ( obj ) { find( obj ); } );

              }

              /**
               * initialize all founded ccm instances (recursive, asynchron)
               */
              function init() {

                // all results initialized? => perform ready functions
                if ( i === results.length ) return ready();

                /**
                 * first founded and not init-checked result
                 * @type {ccm.types.instance}
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
     * provides a ccm datastore
     * @param {ccm.types.settings} settings - ccm datastore settings
     * @param {ccm.types.storeResult} [callback] - when datastore is ready for use
     */
    store: ( settings, callback ) => {

      // clone datastore settings
      settings = self.helper.clone( settings );

      // given settings are no datastore settings? => use given value for initial local cache
      if ( !self.helper.isDatastoreSettings( settings ) ) settings = { local: settings };

      // no local cache? => use empty object
      if ( !settings.local ) settings.local = {};

      // local cache is an URL or a resource data object? => load initial datasets for local cache (could be asynchron)
      if ( typeof settings.local === 'string' || self.helper.isResourceDataObject( settings.local ) )
        self.load( settings.local, proceed );
      else
        proceed( settings.local );

      /** @param {ccm.types.datasets} datasets - initial datasets for local cache */
      function proceed( datasets ) {

        // set initial datasets for local cache
        settings.local = self.helper.clone( datasets );

        /**
         * created ccm datastore
         * @type {ccm.Datastore}
         */
        const store = new Datastore();

        // integrate the datastore settings into the datastore
        self.helper.integrate( settings, store );

        // initialize ccm datastore and perform callback with created ccm datastore
        store.init( () => callback && callback( store ) );

      }

    },

    /**
     * requests a dataset of a ccm datastore
     * @param {ccm.types.settings} settings - settings for the ccm datastore
     * @param {string|Object} [key_or_query={}] - unique key of the dataset or alternative a query (it's possible to use dot notation to get a specific inner value of a single dataset)
     * @param {function} [callback] - callback (first parameter is the requested ccm datastore)
     */
    get: ( settings, key_or_query, callback ) => self.store( settings, store => {

      // support dot notation to get a specific inner value of a single dataset
      let property;
      if ( typeof key_or_query === 'string' ) {
        property = key_or_query.split( '.' );
        key_or_query = property.shift();
        property = property.join( '.' );
      }

      // get dataset out of the datastore
      store.get( key_or_query, result => callback( property ? self.helper.deepValue( result, property ) : result ) );

    } ),

    /**
     * updates a dataset of a ccm datastore
     * @param {ccm.types.settings} settings - settings for the ccm datastore
     * @param {Object} priodata - priority data
     * @param [callback] - callback (first parameter is the updated dataset)
     */
    set: ( settings, priodata, callback ) => self.store( settings, store => store.set( priodata, callback ) ),

    /**
     * deletes a dataset of a ccm datastore
     * @param {ccm.types.settings} settings - settings for the ccm datastore
     * @param {string} key - unique key of the dataset
     * @param [callback] - callback (first parameter is the deleted dataset)
     */
    del: ( settings, key, callback ) => self.store( settings, store => store.del( key, callback ) ),

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
       * @param {Object} [context]
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
       * @summary converts an array into an object
       * @param {Array|object} obj - array or object that contains the array
       * @param {string} [key] - object property where the array is to be found
       * @returns {Object.<string,boolean>} resulting object
       * @example console.log( arrToObj( [ 'foo', 'bar' ] ) ); => { foo: true, bar: true }
       */
      arrToObj: function arrToObj( obj, key ) {

        var arr = key ? obj[ key ] : obj;
        if ( !Array.isArray( arr ) ) return;

        var result = {};
        arr.map( function ( value ) { result[ value ] = true; } );
        if ( key ) obj[ key ] = result;
        return result;

      },

      cleanObject: function ( obj ) {

        for ( var key in obj )
          if ( !obj[ key ] )
            delete obj[ key ];
          else if ( typeof obj[ key ] === 'object' && !self.helper.isNode( obj[ key ] ) && !self.helper.isInstance( obj[ key ] ) )
            self.helper.cleanObject( obj[ key ] );

        return obj;

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
       * @summary compares two version numbers (given as string)
       * @description Version numbers must be conform with Semantic Versioning 2.0.0 ({@link http://semver.org}).
       * @param {string} a - 1st version number
       * @param {string} b - 2nd version number
       * @returns {number} -1: a < b, 0: a = b, 1: a > b
       * @example console.log( compareVersions( '8.0.1', '8.0.10' ) ); => -1
       */
      compareVersions: ( a, b ) => {

        if ( a === b ) return 0;
        const a_arr = a.split( '.' );
        const b_arr = b.split( '.' );
        for ( let i = 0; i < 3; i++ ) {
          const x = parseInt( a_arr[ i ] );
          const y = parseInt( b_arr[ i ] );
          if      ( x < y ) return -1;
          else if ( x > y ) return  1;
        }
        return 0;

      },

      /**
       * @summary converts dot notations in object keys to deeper properties
       * @param {Object} obj - contains object keys in dot notation
       * @returns {Object} object with converted object keys
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

      dataset: ( store, key, callback ) => {
        let user;
        if ( typeof key === 'function' ) {
          callback = key;
          if ( store.store ) {
            key = store.key;
            store = store.store;
            user = store.user;
          }
          else return callback( store );
        }
        if ( self.helper.isInstance( user ) ) user.login( proceed ); else proceed();
        function proceed() {
          if ( !key ) key = self.helper.generateKey();
          if ( self.helper.isInstance( user ) ) key = [ instance.user.data().id, key ];
          store.get( key, dataset => {
            callback( dataset === null ? { key: key } : dataset );
          } );
        }
      },

      /*
      // prepare dataset key
      if ( settings.store.key && !dataset.key ) dataset.key = settings.store.key;
      if ( settings.store.user && instance.user && instance.user.isLoggedIn() ) dataset.key = [ instance.user.data().id, dataset.key || self.helper.generateKey() ];
      */

      decode: function ( obj ) {

        if ( typeof obj === 'string' ) return JSON.parse( obj.replace( /'/g, '"' ) );
        for ( var key in obj )
          if ( typeof obj[ key ] === 'string' && self.helper.regex( 'json' ).test( obj[ key ] ) )
            obj[ key ] = JSON.parse( obj[ key ].replace( /'/g, '"' ) );
          else if ( typeof obj[ key ] === 'object' && !self.helper.isNode( obj[ key ] ) && !self.helper.isInstance( obj[ key ] ) )
            self.helper.decode( obj[ key ] );
        return obj;

      },

      decodeDependencies: function ( obj ) {

        for ( var key in obj )
          if ( typeof obj[ key ] === 'string' && /^\[\W*ccm\.\w+.*\]$/.test( obj[ key ] ) )
            obj[ key ] = JSON.parse( obj[ key ].replace( /'/g, '"' ) );
          else if ( self.helper.isObject( obj[ key ] ) && !self.helper.isNode( obj[ key ] ) && !self.helper.isInstance( obj[ key ] ) )
            self.helper.decodeDependencies( obj[ key ] );

      },

      /**
       * @summary get or set the value of a deeper object property
       * @param {Object} obj - object that contains the deeper property
       * @param {string} key - key path to the deeper property in dot notation
       * @param {*} [value] - value that should be set for the deeper property
       * @returns {*} value of the deeper property
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
          if ( !obj[ next ] && value !== undefined ) obj[ next ] = isNaN( key[ 0 ] ) ? {} : [];
          return recursive( obj[ next ], key, value );  // recursive call

        }

      },

      encode: function ( obj, inner ) {

        if ( typeof obj !== 'object' ) return;
        if ( !inner ) return JSON.stringify( obj ).replace( /"/g, "'" );
        for ( var key in obj )
          if ( typeof obj[ key ] === 'object' )
            obj[ key ] = JSON.stringify( obj[ key ] ).replace( /"/g, "'" );
        return obj;

      },

      encodeDependencies: function ( obj ) {

        for ( var key in obj )
          if ( self.helper.isDependency( obj[ key ] ) )
            obj[ key ] = JSON.stringify( obj[ key ] ).replace( /"/g, "'" );
          else if ( self.helper.isObject( obj[ key ] ) && !self.helper.isNode( obj[ key ] ) && !self.helper.isInstance( obj[ key ] ) )
            self.helper.encodeDependencies( obj[ key ] );

      },

      /**
       * @summary perform function by function name
       * @param {string} functionName - function name
       * @param {Array} [args] - function arguments
       * @param {Object} [context] - context for this
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

      /**
       * @summary fills input elements with start values
       * @param {Element} element - HTML element which contains the input fields (must not be a HTML form tag)
       * @param {Object} data - contains the start values for the input elements
       * @example
       * var result = ccm.helper.fillForm( document.body, { username: 'JohnDoe', password: '1aA' } );
       */
      fillForm: ( element, data ) => {

        data = self.helper.clone( self.helper.protect( data ) );
        const dot = self.helper.toDotNotation( data );
        for ( const key in dot ) data[ key ] = dot[ key ];
        for ( const key in data ) {
          if ( !data[ key ] ) continue;
          if ( typeof data[ key ] === 'object' ) data[ key ] = self.helper.encode( data[ key ] );
          [ ...element.querySelectorAll( '[name="' + key + '"]' ) ].map( input => {
            if ( input.type === 'checkbox' ) {
              if ( typeof data[ key ] === 'string' && data[ key ].charAt( 0 ) === '[' )
                self.helper.decode( data[ key ] ).map( value => { if ( value === input.value ) input.checked = true; } );
              else
                input.checked = true;
            }
            else if ( input.type === 'radio' && data[ key ] === input.value )
              input.checked = true;
            else if ( input.tagName.toLowerCase() === 'select' ) {
              if ( typeof data[ key ] === 'string' && data[ key ].charAt( 0 ) === '[' ) data[ key ] = self.helper.decode( data[ key ] );
              [ ...input.querySelectorAll( 'option' ) ].map( option => {
                if ( Array.isArray( data[ key ] ) )
                  self.helper.decode( data[ key ] ).map( value => { if ( value === ( option.value ? option.value : option.innerHTML.trim() ) ) option.selected = true; } );
                else if ( data[ key ] === ( option.value ? option.value : option.innerHTML.trim() ) )
                  option.selected = true;
              } );
            }
            else
              input.value = data[ key ];
          } );
        }

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
       * @summary finds a parent element with a specific HTML class
       * @param {Element} elem - starting element
       * @param {string} value - HTML class of the parent
       * @returns {Element} parent element that has the given HTML class
       * @example
       * var parent = ccm.helper.html( { class: 'foo', inner: { inner: { id: 'elem' } } } );
       * var elem = parent.querySelector( '#elem' );
       * console.log( ccm.helper.findParentElementByClass( elem, 'foo' ) ); // => parent element
       */
      findParentElementByClass: function ( elem, value ) {

        while ( elem && elem.classList && !elem.classList.contains( value ) )
          elem = elem.parentNode;
        return elem.classList.contains( value ) ? elem : null;

      },

      /**
       * @summary replaces placeholder in data with given values
       * @param {*} data - data with contained placeholders
       * @param {...*} [values] - given values
       * @returns {*} data with replaced placeholders
       */
      format: function ( data, values ) {

        var temp = [[],[],{}];

        data = JSON.stringify( data, function ( key, val ) {
          if ( typeof val === 'function' ) { temp[ 0 ].push( val ); return '%$0%'; }
          return val;
        } );

        var obj_mode = data.indexOf( '{' ) === 0;

        for ( var i = 1; i < arguments.length; i++ ) {
          if ( typeof arguments[ i ] === 'object' )
            for ( var key in arguments[ i ] ) {
              if ( typeof arguments[ i ][ key ] === 'string' )
                arguments[ i ][ key ] = escape( arguments[ i ][ key ] );
              else if ( obj_mode ) {
                temp[ 2 ][ key ] = arguments[ i ][ key ];
                arguments[ i ][ key ] = '%$2%'+key+'%';
              }
              data = data.replace( new RegExp( '%'+key+'%', 'g' ), arguments[ i ][ key ] );
            }
          else {
            if ( typeof arguments[ i ] === 'string' )
              arguments[ i ] = escape( arguments[ i ] );
            else if ( obj_mode ) {
              temp[ 1 ].push( arguments[ i ] );
              arguments[ i ] = '%$1%';
            }
            data = data.replace( /%%/, arguments[ i ] );
          }
        }

        return JSON.parse( data, function ( key, val ) {
          if ( val === '%$0%' ) return temp[ 0 ].shift();
          if ( val === '%$1%' ) return temp[ 1 ].shift();
          if ( typeof val === 'string' && val.indexOf( '%$2%' ) === 0 ) return temp[ 2 ][ val.split( '%' )[ 2 ] ];
          return val;
        } );

        function escape( string ) {
          return string.replace( /"/g, "'" ).replace( /\\/g, '\\\\' ).replace( /\n/g, '\\n' ).replace( /\r/g, '\\r' ).replace( /\t/g, '\\t' ).replace( /\f/g, '\\f' );
        }

      },

      /**
       * @summary gets the input data of a form
       * @param {Element} element - HTML element which contains the input fields (must not be a HTML form tag)
       * @returns {Object} input data
       * @example
       * var result = ccm.helper.formData( document.body );
       * console.log( result );  // { username: 'JohnDoe', password: '1aA' }
       */
      formData: element => {

        const data = {};
        [ ...element.querySelectorAll( '[name]' ) ].map( input => {
          if ( input.type === 'checkbox' ) {
            const value = input.checked ? ( input.value === 'on' ? true : input.value ) : ( input.value === 'on' ? false : '' );
            const multi = [ ...element.querySelectorAll( '[name="' + input.name + '"]' ) ].length > 1;
            if ( multi ) {
              if ( !data[ input.name ] ) data[ input.name ] = [];
              data[ input.name ].push( value );
            }
            else data[ input.name ] = value;
          }
          else if ( input.type === 'radio' ) {
            data[ input.name ] = input.checked ? input.value : ( data[ input.name ] ? data[ input.name ] : '' );
          }
          else if ( input.tagName.toLowerCase() === 'select' ) {
            let result = [];
            [ ...input.querySelectorAll( 'option' ) ].map( option => option.selected && result.push( option.value ? option.value : option.inner ) );
            switch ( result.length ) {
              case 0: result = '';          break;
              case 1: result = result[ 0 ]; break;
            }
            data[ input.name ] = result;
          }
          else if ( input.type === 'number' || input.type === 'range' ) {
            let value = parseInt( input.value );
            if ( isNaN( value ) ) value = '';
            data[ input.name ] = value;
          }
          else if ( !input.value )
            data[ input.name ] = '';
          else
            data[ input.name ] = input.value;
          try {
            if ( typeof data[ input.name ] === 'string' && self.helper.regex( 'json' ).test( data[ input.name ] ) )
              data[ input.name ] = self.helper.decode( data[ input.name ] );
          } catch ( err ) {}
        } );
        return self.helper.protect( self.helper.solveDotNotation( data ) );

      },

      /**
       * @summary generate instance configuration out of a HTML tag
       * @param {Object} node - HTML tag
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
              try {
                obj[ attr.name ] = attr.value.charAt( 0 ) === '{' || attr.value.charAt( 0 ) === '[' ? JSON.parse( attr.value ) : prepareValue( attr.value );
              } catch ( err ) {}
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
          if ( config.inner ) return;
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
       * @param {string|ccm.types.html|ccm.types.html[]|Element|jQuery} html - <i>ccm</i> HTML data
       * @param {...string} [values] - values to replace placeholder
       * @returns {Element|Element[]} generated HTML
       */
      html: function( html, values ) {

        // HTML string? => convert to HTML elements
        if ( typeof html === 'string' ) html = document.createRange().createContextualFragment( html );

        // jQuery element? => convert to HTML elements
        if ( window.jQuery && html instanceof jQuery ) {
          html = html.get();
          const fragment = document.createDocumentFragment();
          html.map( elem => fragment.appendChild( elem ) );
          html = fragment;
        }

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
                if ( self.helper.isNode( children[ i ] ) )
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
        var tag = document.createElement( 'span' );
        tag.innerHTML = value;
        value = tag.textContent;
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
       * @param {Object} [priodata] - priority data
       * @param {Object} [dataset] - dataset
       * @returns {Object} dataset with integrated priority data
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
       * checks if the value is datastore settings
       * @param {*} value - value to check
       * @returns {boolean}
       */
      isDatastoreSettings: value => !!( value.local || value.store ),

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
              case 'ccm.module':
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

      isFirefox: function () {

        return navigator.userAgent.search( 'Firefox' ) > -1;

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
       * checks if a value is a valid ccm dataset key
       * @param {*} value - value to check
       * @returns {boolean}
       */
      isKey: value => {

        // value is a string? => check if it is an valid key
        if ( typeof value === 'string' ) {
          if ( !self.helper.regex( 'key' ).test( value ) )
            return invalid();
        }

        // value is an array? => check if it is an valid array key
        else if ( Array.isArray( value ) ) {
          for ( let i = 0; i < value.length; i++ )
            if ( !self.helper.regex( 'key' ).test( value[ i ] ) )
              return invalid();
        }

        // value is not a dataset key? => value is invalid
        else invalid();

        // value is a valid dataset key
        return true;

        /**
         * logs in the browser console that the value is invalid
         * @returns {boolean}
         */
        function invalid() {
          self.helper.log( 'This value is not a valid dataset key:', value );
          return false;
        }

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
       */
      isProxy: function ( value ) {

        return self.helper.isInstance( value ) && typeof value.component === 'string';

      },

      /**
       * checks if a value is an resource data object
       * @param {*} value - value to check
       * @returns {boolean}
       */
      isResourceDataObject: value => self.helper.isObject( value ) && value.url && ( value.context || value.method || value.params || value.attr || value.ignore_cache || value.type ) && true,

      isSafari: function () {

        return /^((?!chrome|android).)*safari/i.test( navigator.userAgent );

      },

      /**
       * @summary checks if an object is a subset of another object
       * @param {Object} obj - object
       * @param {Object} other - another object
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
       * logs a ccm-specific message in the browser console
       * @param {*} message
       */
      log: message => console.log( '[ccm]', message ),

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
       * @param {boolean} [instance.onfinish.login] - user will be logged in if not already logged in (only works if the instance has a public property "user" with a <i>ccm</i> user instance as the value)
       * @param {boolean} [instance.onfinish.log] - log result data in browser console
       * @param {Object} [instance.onfinish.clear] - clear website area of the finished <i>ccm</i> instance
       * @param {Object} [instance.onfinish.store] - use this to store the result data in a data store
       * @param {ccm.types.settings} instance.onfinish.store.settings - settings for a <i>ccm</i> datastore (result data will be set in this datastore)
       * @param {ccm.types.key} [instance.onfinish.store.key] - dataset key for result data (default is generated key)
       * @param {boolean} [instance.onfinish.store.user] - if set, the key is extended by the user ID of the logged-in user (only works if the instance has a public property "user" with a <i>ccm</i> user instance as the value and the user is logged in)
       * @param {Object} [instance.onfinish.permissions] - permission settings for set operation
       * @param {boolean} [instance.onfinish.restart] - restart finished <i>ccm</i> instance
       * @param {Object} [instance.onfinish.render] - render other content (could be <i>ccm</i> HTML data or data for embedding another <i>ccm</i> component)
       * @param {string|object} [instance.onfinish.render.component] - URL, index, or object of the <i>ccm</i> component that should be embed
       * @param {Object} [instance.onfinish.render.config] - instance configuration for embed
       * @param {callback} [instance.onfinish.callback] - additional individual finish callback (will be called after the performed minor actions)
       * @param {Object} results - result data
       * @example
       * instance.onfinish = {
       *   login: true,
       *   log: true,
       *   clear: true,
       *   store: {
       *     settings: { store: 'example', url: 'path/to/server/interface.php' },
       *     key: 'example',
       *     user: true,
       *     permissions: {
       *       creator: 'akless2m',
       *       group: {
       *         mkaul2m: true,
       *         akless2s: true
       *       },
       *       access: {
       *         get: 'all',
       *         set: 'group',
       *         del: 'creator'
       *       }
       *     }
       *   },
       *   restart: true,
       *   render: {
       *     component: 'component_url',
       *     config: {...}
       *   },
       *   callback: function ( instance, results ) { console.log( results ); }
       * };
       */
      onFinish: ( instance, results ) => {

        /**
         * settings for onfinish actions
         * @type {function|string|Object}
         */
        const settings = instance.onfinish;

        // no finish callback? => abort
        if ( !settings ) return;

        // no result data and the instance has a method 'getValue'? => get result data from that method
        if ( results === undefined && instance.getValue ) results = instance.getValue();

        // has only function? => abort and call it as finish callback
        if ( typeof settings === 'function' ) return settings( instance, results );

        // has only string as global function name? => abort and call it as finish callback
        if ( typeof settings === 'string' ) return this.executeByName( settings, [ instance, results ] );

        /**
         * highest user instance in ccm context
         * @type {ccm.types.instance}
         */
        const user = instance.user || self.context.find( instance, 'user' );

        // has user instance? => login user (if not already logged in)
        if ( settings.login && user ) user.login( proceed ); else proceed();

        function proceed() {

          // log result data (if necessary)
          if ( settings.log ) console.log( results );

          // clear website area of the instance (if necessary)
          if ( settings.clear ) instance.element.innerHTML = '';

          // has to store result data in a datastore?
          if ( self.helper.isObject( settings.store ) && settings.store.settings && self.helper.isObject( results ) ) {

            /**
             * deep copy of result data
             * @type {Object}
             */
            const dataset = self.helper.clone( results );

            // prepare dataset key
            if ( settings.store.key && !dataset.key ) dataset.key = settings.store.key;
            if ( settings.store.user && user && user.isLoggedIn() ) dataset.key = [ user.data().id, dataset.key || self.helper.generateKey() ];

            // prepare permission settings
            if ( settings.store.permissions ) dataset._ = settings.store.permissions;

            // store result data in datastore
            self.set( settings.store.settings, dataset, proceed );

          }
          else proceed();

          function proceed() {

            // restart instance (if necessary)
            if ( settings.restart ) instance.start( proceed ); else proceed();

            function proceed() {

              // render other content (if necessary)
              if ( settings.render )
                if ( self.helper.isObject( settings.render ) && settings.render.component ) {
                  let config = settings.render.config;
                  if ( !config ) config = {};
                  self.start( settings.render.component, config, result => {
                    self.helper.replace( result.root, instance.root );
                    proceed();
                  } );
                  return;
                }
                else self.helper.replace( self.helper.html( settings.render ), instance.root );
              proceed();

              function proceed() {

                // perform finish callback (if necessary)
                settings.callback && settings.callback( instance, results );

              }

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
       * @returns {Object} object that contains the privatized properties and there values
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
            case 'dependency':
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
          case 'key':      return /^[a-zA-Z0-9_\-]+$/;
          case 'json':     return /^({.*})|(\[.*])$/;
        }

      },

      removeElement: function ( element ) {
        if ( element.parentNode ) element.parentNode.removeChild( element );
      },

      /**
       * renames the property name of an object
       * @param obj - the object that contains the property name
       * @param before - old property name
       * @param after - new property name
       * @example
       * const obj = { foo: 5711 };
       * ccm.helper.renameProperty( obj, 'foo', 'bar' );
       * console.log( obj );  // => { "bar": 5711 }
       */
      renameProperty: ( obj, before, after ) => {
        if ( obj[ before ] === undefined ) return delete obj[ before ];
        obj[ after ] = obj[ before ];
        delete obj[ before ];
      },

      replace: ( newnode, oldnode ) => {

        oldnode.parentNode && oldnode.parentNode.replaceChild( self.helper.protect( newnode ), oldnode );

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
       * @param {object|ccm.types.action} obj - object that contains the <i>ccm</i> dependency or the dependency itself
       * @param {number|string|function} [key] - object key that contains the <i>ccm</i> dependency
       * @param {function} [callback] - callback (first parameter is the result of the solved dependency)
       * @returns {*} result of the solved dependency (only if synchron)
       * @example
       * var obj = { layout: [ ccm.load, 'style.css' ] };
       * ccm.helper.solveDependency( obj, 'layout', function ( result ) {
       *   console.log( result );  // => 'style.css'
       * } );
       */
      solveDependency: function ( obj, key, callback ) {

        // key parameter is a function? => key skipped
        if ( typeof key === 'function' ) { callback = key; key = undefined; }

        /**
         * ccm dependency
         * @type {ccm.types.action}
         */
        var action = self.helper.clone( key === undefined ? obj : obj[ key ] );

        // no ccm action data? => abort and perform callback without a result
        if ( !self.helper.isDependency( action ) ) { if ( callback ) callback(); return; }

        // determine ccm interface
        action[ 0 ] = self[ action[ 0 ].split( '.' ).pop() ];

        // add a callback
        action.push( function ( result ) {
          if ( key !== undefined ) obj[ key ] = result;      // replace ccm dependency with the result of the solved dependency
          if ( callback ) callback( result );
        } );

        // perform the ccm action data of the ccm dependency
        return self.helper.action( action );

      },

      /**
       * transforms a flat object which has dot notation in it's keys as path to deeper properties to an object with deeper structure
       * @param {Object} obj
       * @returns {Object}
       */
      solveDotNotation: function ( obj ) {

        for ( const key in obj )
          if ( key.indexOf( '.' ) !== -1 ) {
            self.helper.deepValue( obj, key, obj[ key ] );
            delete obj[ key ];
          }
        return obj;

      },

      /**
       * transforms an object with deeper structure to a flat object with dot notation in each key as path to deeper properties
       * @param {Object} obj
       * @returns {Object}
       */
      toDotNotation: function ( obj ) {

        const result = {};
        recursive( obj, '' );
        return result;

        function recursive( obj, prefix ) {

          for ( const key in obj )
            if ( typeof obj[ key ] === 'object' )
              recursive( obj[ key ], prefix + key + '.' );
            else
              result[ prefix + key ] = obj[ key ];

        }

      },

      toJSON: function ( value ) {
        return JSON.parse( JSON.stringify( value ) );
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

  // set framework version specific namespace
  if ( self.version && !ccm[ self.version() ] ) ccm[ self.version() ] = self;

  // update namespace for latest framework version
  if ( !ccm.version || self.helper.compareVersions( self.version(), ccm.version() ) > 0 ) { ccm.latest = self; self.helper.integrate( self, ccm ); }

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
   *   ready:     function ( callback ) { ...; callback(); },
   *   instance:  function ( config, callback ) {...},
   *   start:     function ( config, callback ) {...},
   *   instances: 0
   * }
   */

  /**
   * @typedef {Object} ccm.types.config
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
   * @typedef {Object} ccm.types.dataset
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
   * @typedef {Object} ccm.types.element
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
   * @typedef {Object} ccm.types.html
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
   * @typedef {Object} ccm.types.instance
   * @summary <i>ccm</i> instance
   * @property {number} id - <i>ccm</i> instance id (unique in own component)
   * @property {string} index - <i>ccm</i> instance index (unique in <i>ccm</i> framework)<br>A <i>ccm</i> instance index is made up of own [component name]{@link ccm.types.name} and own [id]{@link ccm.types.instance} (example: <code>"chat-1"</code>).
   * @property {ccm.types.component} component - reference to associated <i>ccm</i> component
   * @property {ccm.types.dependency} dependency - own dependency
   * @property {function} init - callback when this <i>ccm</i> instance is created and before dependencies of dependent resources are solved
   * @property {function} ready - callback when all dependencies of dependent resources are solved
   * @property {function} start - start instance
   */

  /**
   * @typedef {Object} ccm.types.JqXHR
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
   * @typedef {Object} ccm.types.node
   * @summary HTML node
   * @description For more informations see ({@link http://www.w3schools.com/jsref/dom_obj_all.asp}).
   */

  /**
   * @typedef {Object} ccm.types.resource
   * @summary <i>ccm</i> resource data
   * @property {string} url - URL of the resource
   * @property {Element} [context=document.head] - context in which the resource should be loaded (default is <head>)
   * @property {string} [method='GET'] - HTTP method to use: 'GET', 'POST' or 'JSONP' (default is 'GET')
   * @property {Object} [params] - HTTP parameters to send (in the case of a data exchange)
   * @property {obj} [attr] - HTML attributes to be set for the HTML tag that loads the resource
   * @property {boolean} [ignore_cache] - ignore any result already cached by <i>ccm</i>
   */

  /**
   * @callback ccm.types.setResult
   * @summary callback when an create or update operation is finished
   * @param {ccm.types.dataset} result - created or updated dataset
   * @example function ( result ) { console.log( result ) }
   */

  /**
   * @typedef {Object} ccm.types.settings
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