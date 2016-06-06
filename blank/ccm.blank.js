/**
 * @overview blank template for <i>ccm</i> components
 * @author André Kless <andre.kless@web.de> 2016
 * @license The MIT License (MIT)
 */

ccm.component( /** @lends ccm.components.blank */ {

  /*-------------------------------------------- public component members --------------------------------------------*/

  /**
   * @summary unique component name
   * @type {ccm.type.name}
   */
  name: 'blank',

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
       * @type {ccm.type.element}
       */
      var element = ccm.helper.element( this );

      // set content of own website area
      element.html( 'Hello, World!' );

      // perform callback
      if ( callback ) callback();

    }

  }

  /*------------------------------------------------ type definitions ------------------------------------------------*/

  /**
   * @namespace ccm.components.blank
   */

  /**
   * @external ccm.types
   * @see {@link http://akless.github.io/ccm-developer/api/ccm/ccm.types.html}
   */

} );