/**
 * @overview tests for <i>ccm</i> framework
 * @author André Kless <andre.kless@web.de> 2016
 * @license The MIT License (MIT)
 */

if ( !ccm.components.testsuite ) ccm.components.testsuite = {};
ccm.components.testsuite.ccm = {
  setup: function ( suite, callback ) {
    ccm.clear();
    callback();
  },
  load: {
    html: {
      setup: function ( suite, callback ) {
        suite.expected_html_result = '<span>Hello, <b>World</b>!</span><br>\n<i>This is only a test file.</i>';
        callback();
      },
      tests: {
        'local': function ( suite ) {
          ccm.load( 'dummy/dummy.html', function ( result ) {
            suite.assertSame( suite.expected_html_result, result );
          } );
        },
        'remote': function ( suite ) {
          ccm.load( 'https://kaul.inf.h-brs.de/ccm/html/dummy.html', function ( result ) {
            suite.assertSame( suite.expected_html_result, result );
          } );
        },
        'cached': function ( suite ) {
          ccm.load( 'https://kaul.inf.h-brs.de/ccm/html/dummy.html', function () {
            var local_cached_return_value = ccm.load( 'https://kaul.inf.h-brs.de/ccm/html/dummy.html' );
            suite.assertSame( suite.expected_html_result, local_cached_return_value );
          } );
        }
      }
    },
    css: {
      tests: {
        'local': function ( suite ) {
          ccm.load( 'dummy/dummy.css', function ( result ) {
            suite.assertSame( 'dummy/dummy.css', result );
          } );
        },
        'remote': function ( suite ) {
          ccm.load( 'https://kaul.inf.h-brs.de/ccm/css/dummy.css', function ( result ) {
            suite.assertSame( 'https://kaul.inf.h-brs.de/ccm/css/dummy.css', result );
          } );
        },
        'cached': function ( suite ) {
          ccm.load( 'https://kaul.inf.h-brs.de/ccm/css/dummy.css', function () {
            var local_cached_return_value = ccm.load( 'https://kaul.inf.h-brs.de/ccm/css/dummy.css' );
            suite.assertSame( 'https://kaul.inf.h-brs.de/ccm/css/dummy.css', local_cached_return_value );
          } );
        }
      }
    },
    image: {
      tests: {
        'local': function ( suite ) {
          ccm.load( 'dummy/dummy.png', function ( result ) {
            suite.assertSame( 'dummy/dummy.png', result );
          } );
        },
        'remote': function ( suite ) {
          ccm.load( 'https://kaul.inf.h-brs.de/ccm/img/config.png', function ( result ) {
            suite.assertSame( 'https://kaul.inf.h-brs.de/ccm/img/config.png', result );
          } );
        },
        'cached': function ( suite ) {
          ccm.load( 'https://kaul.inf.h-brs.de/ccm/img/config.png', function () {
            var local_cached_return_value = ccm.load( 'https://kaul.inf.h-brs.de/ccm/img/config.png' );
            suite.assertSame( 'https://kaul.inf.h-brs.de/ccm/img/config.png', local_cached_return_value );
          } );
        }
      }
    },
    js: {
      tests: {
        'local': function ( suite ) {
          ccm.load( 'dummy/dummy.js', function ( result ) {
            suite.assertSame( 'dummy/dummy.js', result );
          } );
        },
        'remote': function ( suite ) {
          ccm.load( 'https://kaul.inf.h-brs.de/ccm/lib/jquery.js', function ( result ) {
            suite.assertSame( 'https://kaul.inf.h-brs.de/ccm/lib/jquery.js', result );
          } );
        },
        'cached': function ( suite ) {
          ccm.load( 'https://kaul.inf.h-brs.de/ccm/lib/jquery.js', function () {
            var local_cached_return_value = ccm.load( 'https://kaul.inf.h-brs.de/ccm/lib/jquery.js' );
            suite.assertSame( 'https://kaul.inf.h-brs.de/ccm/lib/jquery.js', local_cached_return_value );
          } );
        },
        'executed': function ( suite ) {
          delete window.jQuery;
          ccm.load( 'https://kaul.inf.h-brs.de/ccm/lib/jquery.js', function () {
            suite.assertTrue( window.jQuery );
            delete window.jQuery;
          } );
        }
      }
    }
  },
  store: {
    create: {
      tests: {
        'localReturn': function ( suite ) {
          suite.assertTrue( ccm.helper.isDatastore( ccm.store() ) );
        },
        'localCallback': function ( suite ) {
          ccm.store( function ( store ) {
            suite.assertTrue( ccm.helper.isDatastore( store ) );
          } );
        },
        'noClientReturn': function ( suite ) {
          suite.assertFalse( ccm.helper.isDatastore( ccm.store( { store: 'test' } ) ) );
        },
        'clientCallback': function ( suite ) {
          ccm.store( { store: 'test' }, function ( store ) {
            suite.assertTrue( ccm.helper.isDatastore( store ) );
          } );
        },
        'serverReturn': function ( suite ) {
          suite.assertTrue( ccm.helper.isDatastore( ccm.store( { url: 'https://ccm.inf.h-brs.de', store: 'test' } ) ) );
        },
        'noServerRealtimeReturn': function ( suite ) {
          suite.assertFalse( ccm.helper.isDatastore( ccm.store( { url: 'wss://ccm.inf.h-brs.de', store: 'test' } ) ) );
        },
        'serverCallback': function ( suite ) {
          ccm.store( { url: 'https://ccm.inf.h-brs.de', store: 'test' }, function ( store ) {
            suite.assertTrue( ccm.helper.isDatastore( store ) );
          } );
        }
      }
    },
    local: {
      get: {
        setup: function ( suite, callback ) {
          suite.store = ccm.store();
          callback();
        },
        tests: {
          'exists': function ( suite ) {
            var dataset = { key: 'existing_key' };
            suite.store.set( dataset );
            suite.assertEquals( dataset, suite.store.get( 'existing_key' ) );
          },
          'notExists': function ( suite ) {
            suite.assertEquals( null, suite.store.get( 'not_existing_key' ) );
          },
          'query': function ( suite ) {
            var foo = { key: 'foo', value: 127, exists: false };
            var bar = { key: 'bar', value: 4711, exists: true };  // match
            var baz = { key: 'baz', value: 127, exists: true };
            var abc = { key: 'abc', value: 4711, exists: false };
            var xyz = { key: 'xyz', value: 4711, exists: true };  // match
            suite.store.set( foo );
            suite.store.set( bar );
            suite.store.set( baz );
            suite.store.set( abc );
            suite.store.set( xyz );
            suite.assertEquals( [ bar, xyz ], suite.store.get( { value: 4711, exists: true } ) );
          },
          'all': function ( suite ) {
            var datasets = [ { key: 'foo' }, { key: 'bar' }, { key: 'baz' } ];
            suite.store.set( datasets[ 0 ] ); suite.store.set( datasets[ 1 ] ); suite.store.set( datasets[ 2 ] );
            suite.assertEquals( datasets, suite.store.get() );
          },
          'allEmpty': function ( suite ) {
            suite.assertEquals( [], suite.store.get() );
          }
        }
      }
    }
  },
  helper: {
    deepValue: {
      tests: {
        'get': function ( suite ) {
          var obj = {
            test: 123,
            foo: {
              bar: 'abc',
              baz: 'xyz'
            }
          };
          suite.assertSame( 'abc', ccm.helper.deepValue( obj, 'foo.bar' ) );
        },
        'setObject': function ( suite ) {
          var obj = {};
          ccm.helper.deepValue( obj, 'foo.bar', 'abc' );
          suite.assertEquals( { foo: { bar: 'abc' } }, obj );
        },
        'setReturn': function ( suite ) {
          var obj = {};
          suite.assertSame( 'abc', ccm.helper.deepValue( obj, 'foo.bar', 'abc' ) );
        }
      }
    },
    isInDOM: {
      setup: function ( suite, callback ) {
        suite.root = document.createElement( 'div' );
        var p = document.createElement( 'p' );
        suite.node = document.createElement( 'span' );
        suite.root.appendChild( p );
        p.appendChild( suite.node );
        callback();
      },
      tests: {
        'bothNodes': function ( suite ) {
          suite.assertTrue( ccm.helper.isInDOM( suite.node, suite.root ) );
        },
        'bothNodesReversed': function ( suite ) {
          suite.assertFalse( ccm.helper.isInDOM( suite.root, suite.node ) );
        },
        'bothNodesEqual': function ( suite ) {
          suite.assertTrue( ccm.helper.isInDOM( suite.root, suite.root ) );
        },
        'noRoot': function ( suite ) {
          suite.root.id = 'dummy';
          var root = suite.root.cloneNode( true );
          document.body.appendChild( root );
          suite.assertTrue( ccm.helper.isInDOM( root ) );
          document.body.removeChild( root );
        },
        'bothInstances': function ( suite ) {
          var component = ccm.component( {
            name: 'dummy',
            Instance: function () {
              this.render = function () {}
            }
          } );
          suite.root = component.instance( suite.root );
          suite.node = component.instance( suite.node );
          suite.assertTrue( ccm.helper.isInDOM( suite.node, suite.root ) );
        }
      }
    },
    solveDependency: {
      setup: function ( suite, callback ) {
        suite.url = 'dummy/dummy.css';
        suite.obj_key = 'dummy';
        callback();
      },
      tests: {
        'callbackResult': function ( suite ) {
          var obj = { dummy: [ ccm.load, suite.url ] };
          ccm.helper.solveDependency( obj, suite.obj_key, function ( result ) {
            suite.assertSame( suite.url, result );
          } );
        },
        'noReturnResult': function ( suite ) {
          var obj = { dummy: [ ccm.load, suite.url ] };
          var result = ccm.helper.solveDependency( obj, suite.obj_key );
          suite.assertFalse( result );
        },
        'cachedReturnResult': function ( suite ) {
          ccm.load( suite.url, function () {
            var obj = { dummy: [ ccm.load, suite.url ] };
            var result = ccm.helper.solveDependency( obj, suite.obj_key );
            suite.assertSame( suite.url, result );
          } );
        }
      }
    }
  }
};