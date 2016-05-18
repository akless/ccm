/**
 * @overview blank template for ccm components
 * @author André Kless <andre.kless@web.de> 2016
 */
ccm.component( {

  name: 'blank',

  Instance: function () {

    this.render = function ( callback ) {

      var element = ccm.helper.element( this );

      element.html( 'Hello, World!' );

      if ( callback ) callback();

    }

  }

} );