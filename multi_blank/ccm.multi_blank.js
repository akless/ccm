/**
 * @overview composition example which shows the integration of an <i>ccm</i> component object
 * @author André Kless <andre.kless@web.de> 2016
 * @license The MIT License (MIT)
 */

ccm.component( /** @lends ccm.components.multi_blank */ {

  /*-------------------------------------------- public component members --------------------------------------------*/

  /**
   * @summary component name
   * @type {ccm.types.name}
   */
  name: 'multi_blank',

  /**
   * @summary default instance configuration
   * @type {ccm.components.multi_blank.types.config}
   */
  config: {

    component: [ ccm.component, '../blank/ccm.blank.js' ],  // integration of an component object
    times: 5

  },

  /*-------------------------------------------- public component classes --------------------------------------------*/

  /**
   * @summary constructor for creating <i>ccm</i> instances out of this component
   * @class
   */
  Instance: function () {

    /*------------------------------------------- public instance methods --------------------------------------------*/

    /**
     * @summary render content in own website area
     * @param {function} [callback] - callback when content is rendered
     */
    this.render = function ( callback ) {

      /**
       * website area for own content
       * @type {ccm.types.element}
       */
      var element = ccm.helper.element( this ).html( '' );

      // iterate given times
      for ( var i = 1; i <= this.times; i++ ) {

        /**
         * unique HTML id
         * @type {string}
         */
        var id = this.index + '-' + i;

        // append inner website area
        element.append( '<div id="' + id + '"></div>' );

        // Embeds the given reused component in the appended inner website area.
        this.component.render( jQuery( '#' + id ) );

      }

      // perform callback
      if ( callback ) callback();

    }

  }

  /*------------------------------------------------ type definitions ------------------------------------------------*/

  /**
   * @namespace ccm.components.multi_blank
   */

  /**
   * @namespace ccm.components.multi_blank.types
   */

  /**
   * @summary <i>ccm</i> instance configuration
   * @typedef {ccm.types.config} ccm.components.multi_blank.types.config
   * @property {ccm.types.element} element - <i>ccm</i> instance website area
   * @property {ccm.types.dependency} style - css for own website area
   * @property {string} classes - html classes for own website area
   * @property {ccm.types.dependency} component - _ccm_ component that has to be embedded several times
   * @property {number} times - amount of times the reused _ccm_ component has to be embedded
   * @example {
   *   element:   jQuery( 'body' ),
   *   style:     [ ccm.load, './style.css' ],
   *   classes:   'ccm-multi_blank',
   *   component: [ ccm.component, '../blank/ccm.blank.js' ],
   *   times:     5
   * }
   */

  /**
   * @external ccm.types
   * @see {@link http://akless.github.io/ccm-developer/api/ccm/ccm.types.html}
   */

} );