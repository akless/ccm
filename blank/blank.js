/**
 * @overview blank template for <i>ccm</i> component
 * @author André Kless <andre.kless@h-brs.de> 2016
 * @license The MIT License (MIT)
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