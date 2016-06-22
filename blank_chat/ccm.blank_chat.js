/**
 * @overview composition example which shows the integration of <i>ccm</i> instances
 * @author André Kless <andre.kless@web.de> 2016
 * @license The MIT License (MIT)
 */

ccm.component( /** @lends ccm.components.blank_chat */ {

  /*-------------------------------------------- public component members --------------------------------------------*/

  /**
   * @summary component name
   * @type {ccm.types.name}
   */
  name: 'blank_chat',

  /**
   * @summary default instance configuration
   * @type {ccm.components.blank_chat.types.config}
   */
  config: {

    instance_a: [ ccm.instance, '../blank/ccm.blank.js' ],
    instance_b: [ ccm.instance, '../chat/ccm.chat.js' ]

  },

  /*-------------------------------------------- public component classes --------------------------------------------*/

  /**
   * @summary constructor for creating <i>ccm</i> instances out of this component
   * @class
   */
  Instance: function () {

    /*------------------------------------------- public instance methods --------------------------------------------*/

    /**
     * @summary initialize <i>ccm</i> instance
     * @description
     * Called one-time when this <i>ccm</i> instance is created, all dependencies are solved and before dependent <i>ccm</i> components, instances and datastores are initialized.
     * This method will be removed by <i>ccm</i> after the one-time call.
     * @param {function} callback - callback when this instance is initialized
     */
    this.init = function ( callback ) {

      // set website area for both given ccm instances
      this.instance_a.element = ccm.helper.find( this, '.a' );
      this.instance_b.element = ccm.helper.find( this, '.b' );

      // perform callback
      callback();

    };

    /**
     * @summary render content in own website area
     * @param {function} [callback] - callback when content is rendered
     */
    this.render = function ( callback ) {

      /**
       * website area for own content
       * @type {ccm.types.element}
       */
      var element = ccm.helper.element( this );

      // insert two inner website areas
      element.html( '<div class="a"></div><div class="b"></div>' );

      // embeds first given ccm instance
      this.instance_a.render();

      // embeds second given ccm instance
      this.instance_b.render();

      // perform callback
      if ( callback ) callback();

    }

  }

  /*------------------------------------------------ type definitions ------------------------------------------------*/

  /**
   * @namespace ccm.components.blank_chat
   */

  /**
   * @namespace ccm.components.blank_chat.types
   */

  /**
   * @summary <i>ccm</i> instance configuration
   * @typedef {ccm.types.config} ccm.components.blank_chat.types.config
   * @property {ccm.types.element} element - <i>ccm</i> instance website area
   * @property {ccm.types.dependency} style - css for own website area
   * @property {string} classes - html classes for own website area
   * @property {ccm.types.dependency} instance_a - first _ccm_ instance that has to be embed
   * @property {ccm.types.dependency} instance_b - second _ccm_ instance that has to be embed
   * @example {
   *   element:    jQuery( 'body' ),
   *   style:      [ ccm.load, './style.css' ],
   *   classes:    'ccm-blank_chat',
   *   instance_a: [ ccm.instance, '../blank/ccm.blank.js' ],
   *   instance_b: [ ccm.instance, '../chat/ccm.chat.js' ]
   * }
   */

  /**
   * @external ccm.types
   * @see {@link http://akless.github.io/ccm-developer/api/ccm/ccm.types.html}
   */

} );