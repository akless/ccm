/**
 * @overview tests for not <i>ccm</i> framework relevant helper functions for <i>ccm</i> component developers
 * @author André Kless <andre.kless@web.de> 2016
 * @license The MIT License (MIT)
 */

if ( !ccm.components.testsuite ) ccm.components.testsuite = {};
ccm.components.testsuite.ccm_helper = {
  wait: {
    tests: {
      'oneSecond': function ( suite ) {
        var time = new Date().getTime();
        ccm.helper.wait( 1000, function () {
          suite.assertSame( 1000, Math.floor( ( new Date().getTime() - time ) / 10 ) * 10 );
        } );
      }
    }
  }
};