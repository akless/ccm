/**
 * @overview tests for not <i>ccm</i> framework relevant helper functions for <i>ccm</i> component developers
 * @author André Kless <andre.kless@web.de> 2016
 * @license The MIT License (MIT)
 */

if ( !ccm.components.testsuite ) ccm.components.testsuite = {};
ccm.components.testsuite.ccm_helper = {
  cleanObject: {
    tests: {
      'withReturn': function ( suite ) {
        suite.assertEquals( { abc: 'xyz' }, ccm.helper.cleanObject( { foo: '', bar: false, baz: null, test: undefined, i: 0, abc: 'xyz' } ) );
      },
      'withoutReturn': function ( suite ) {
        var obj = { foo: '', bar: false, baz: null, test: undefined, i: 0, abc: 'xyz' };
        ccm.helper.cleanObject( obj );
        suite.assertEquals( { abc: 'xyz' }, obj );
      }
    }
  },
  convertObjectKeys: {
    tests: {
      'example': function ( suite ) {
        suite.assertEquals( { test: 123, foo: { bar: 'abc', baz: 'xyz' } }, ccm.helper.convertObjectKeys( { test: 123, 'foo.bar': 'abc', 'foo.baz': 'xyz' } ) );
      }
    }
  },
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