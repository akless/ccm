/**
 * @overview <i>ccm</i> component for simple chats
 * @author André Kless <andre.kless@web.de> 2016
 * @license The MIT License (MIT)
 */
ccm.component( {

  /*-------------------------------------------- public component members --------------------------------------------*/

  /**
   * @summary component name
   * @memberOf ccm.components.chat
   * @type {ccm.type.name}
   */
  name: 'chat',

  /**
   * @summary default instance configuration
   * @memberOf ccm.components.chat
   * @type {ccm.components.chat.config}
   */
  config: {

    html:  [ ccm.store, { local: 'templates.json' } ],
    key:   'test',
    store: [ ccm.store, { url: 'ws://ccm2.inf.h-brs.de/index.js', store: 'chat' } ],
    style: [ ccm.load, 'style.css' ],
    user:  [ ccm.instance, 'https://kaul.inf.h-brs.de/ccm/components/user2.js' ]

  },

  /*-------------------------------------------- public component classes --------------------------------------------*/

  /**
   * @summary constructor for creating <i>ccm</i> instances out of this component
   * @class
   */
  Instance: function () {

    /*------------------------------------- private and public instance members --------------------------------------*/

    /**
     * @summary own context
     * @private
     */
    var self = this;

    /*------------------------------------------- public instance methods --------------------------------------------*/

    /**
     * @summary initialize <i>ccm</i> instance
     * @description
     * Called one-time when this <i>ccm</i> instance is created, all dependencies are solved and before dependent <i>ccm</i> components, instances and datastores are initialized.
     * This method will be removed by <i>ccm</i> after the one-time call.
     * @param {function} callback - callback when this instance is initialized
     */
    self.init = function ( callback ) {

      // listen to change event of ccm realtime datastore => update own content
      self.store.onChange = function () { self.render(); };

      // perform callback
      callback();

    };

    /**
     * @summary render content in own website area
     * @param {function} [callback] - callback when content is rendered
     */
    self.render = function ( callback ) {

      /**
       * website area for own content
       * @type {ccm.type.element}
       */
      var element = ccm.helper.element( self );

      // get dataset for rendering
      self.store.get( self.key, function ( dataset ) {

        // dataset not exists? => create new dataset with given key
        if ( dataset === null )
          self.store.set( { key: self.key, messages: [] }, proceed );
        else
          proceed( dataset );

        function proceed( dataset ) {

          // render main html structure
          element.html( ccm.helper.html( self.html.get( 'main' ) ) );

          /**
           * website area for already existing messages
           * @type {ccm.type.element}
           */
          var messages_div = ccm.helper.find( self, '.messages' );

          // iterate over message datasets
          for ( var i = 0; i < dataset.messages.length; i++ ) {

            /**
             * message dataset
             * @type {ccm.components.chat.message}
             */
            var message = dataset.messages[ i ];

            // render html structure for a given message
            messages_div.append( ccm.helper.html( self.html.get( 'message' ), {

              name: ccm.helper.val( message.user ),
              text: ccm.helper.val( message.text )

            } ) );

          }

          // render input field for a new message
          messages_div.append( ccm.helper.html( self.html.get( 'input' ), { onsubmit: function () {

            /**
             * submitted massage
             * @type {string}
             */
            var value = ccm.helper.val( ccm.helper.find( self, 'input' ).val() ).trim();

            // message is empty? => abort
            if ( value === '' ) return;

            // login user if not logged in
            self.user.login( function () {

              // add submitted massage in dataset for rendering
              dataset.messages.push( { user: self.user.data().key, text: value } );

              // update dataset for rendering in datastore
              self.store.set( dataset, function () { self.render(); } );

            } );

            // prevent page reload
            return false;

          } } ) );

          // perform callback
          if ( callback ) callback();

        }

      } );

    };

  }

  /*------------------------------------------------ type definitions ------------------------------------------------*/

  /**
   * @namespace ccm.components.chat
   */

  /**
   * @summary <i>ccm</i> instance configuration
   * @typedef {ccm.type.config} ccm.components.chat.config
   * @property {ccm.type.element} element - <i>ccm</i> instance website area
   * @property {ccm.type.dependency} html - <i>ccm</i> datastore for html templates
   * @property {ccm.type.url} style - URL to a css file which contains the styles for own website area
   * @property {string} classes - html classes for own website area
   * @property {ccm.type.dependency} store - <i>ccm</i> datastore that contains the [dataset for rendering]{@link ccm.components.chat.dataset}
   * @property {ccm.type.key} key - key of [dataset for rendering]{@link ccm.components.chat.dataset}
   * @property {ccm.type.dependency} user - <i>ccm</i> instance for user authentification
   */

  /**
   * @summary dataset for rendering
   * @typedef {ccm.type.dataset} ccm.components.chat.dataset
   * @property {ccm.type.key} key - dataset key
   * @property {ccm.components.chat.message[]} messages - already existing [message dataset]{@link ccm.components.chat.message}s
   * @example {
   *   key: 'test',
   *   messages: [
   *     {
   *       text: 'Hello, World!',
   *       user: 'akless'
   *     },
   *     {
   *       text: 'My second message.',
   *       user: 'akless'
   *     }
   *   ]
   * }
   */

  /**
   * @summary message dataset
   * @typedef {ccm.type.dataset} ccm.components.chat.message
   * @property {string} text - message text
   * @property {string} user - username of creator
   * @example {
   *   text: 'Hello, World!',
   *   user: 'akless'
   * }
   */

} );