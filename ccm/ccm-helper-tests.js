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
  loading: {
    setup: function ( suite, callback ) {
      suite.dummy = ccm.instance( { name: 'dummy', Instance: function () { this.render = function () {} } }, ccm.helper.html( {} ) );
      callback();
    },
    tests: {
      'keyframe': function ( suite ) {
        ccm.helper.loading( suite.dummy );
        suite.assertSame( '@keyframes ccm_loading { to { transform: rotate(360deg); } }', suite.dummy.element.parentNode.querySelector( '#ccm_keyframe' ).innerHTML );
      },
      'icon': function ( suite ) {
        suite.assertSame( '<div class="ccm_loading"><div style="display: inline-block; width: 0.5em; height: 0.5em; border: 0.15em solid #009ee0; border-right-color: transparent; border-radius: 50%; animation: ccm_loading 1s linear infinite;"></div></div>', ccm.helper.loading( suite.dummy ).outerHTML );
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