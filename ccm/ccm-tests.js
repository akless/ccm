/**
 * @overview tests for <i>ccm</i> framework
 * @author André Kless <andre.kless@web.de> 2016-2017
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
          ccm.load( 'https://kaul.inf.h-brs.de/ccm/html/dummy_html.js', function ( result ) {
            suite.assertSame( suite.expected_html_result, result );
          } );
        },
        'cached': function ( suite ) {
          ccm.load( 'https://kaul.inf.h-brs.de/ccm/html/dummy_html.js', function () {
            var local_cached_return_value = ccm.load( 'https://kaul.inf.h-brs.de/ccm/html/dummy_html.js' );
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
    get: {
      local: {
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
      /*,
      remote: {
        ccm_inf_h_brs: {
          redis: {
            setup: function ( suite, callback ) {
              suite.store = ccm.store( { url: 'https://ccm.inf.h-brs.de', db: 'redis', store: 'test' } );
              callback();
            },
            tests: {
              'exists': function ( suite ) {
                var dataset = { key: 'existing_key' };
                suite.store.set( dataset );
                suite.store.get( 'existing_key', function ( result ) {
                  delete result.updated_at;
                  suite.assertEquals( dataset, result );
                } );
              },
              'notExists': function ( suite ) {
                suite.store.get( 'not_existing_key', function ( result ) {
                  suite.assertEquals( null, result );
                } );
              }
            }
          },
          mongo: {
            setup: function ( suite, callback ) {
              suite.store = ccm.store( { url: 'https://ccm.inf.h-brs.de', db: 'mongodb', store: 'test' } );
              callback();
            },
            tests: {
              'exists': function ( suite ) {
                var dataset = { key: 'existing_key' };
                suite.store.set( dataset );
                suite.store.get( 'existing_key', function ( result ) {
                  delete result.updated_at;
                  suite.assertEquals( dataset, result );
                } );
              },
              'notExists': function ( suite ) {
                suite.store.get( 'not_existing_key', function ( result ) {
                  suite.assertEquals( null, result );
                } );
              },
              'query': function ( suite ) {
                var foo = { key: 'foo', value:  127, exists: false };
                var bar = { key: 'bar', value: 4711, exists:  true };  // match
                var baz = { key: 'baz', value:  127, exists:  true };
                var abc = { key: 'abc', value: 4711, exists: false };
                var xyz = { key: 'xyz', value: 4711, exists:  true };  // match
                suite.store.set( foo );
                suite.store.set( bar );
                suite.store.set( baz );
                suite.store.set( abc );
                suite.store.set( xyz );
                suite.store.get( { value: 4711, exists: true }, function ( result ) {
                  suite.assertEquals( [ bar, xyz ], result );
                } );
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
      }
      */
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
        'instanceRoot': function ( suite ) {
          var component = ccm.component( {
            name: 'dummy',
            Instance: function () {
              this.render = function () {}
            }
          } );
          suite.root = component.instance( suite.root );
          ccm.helper.setContent( suite.root.element, suite.node );
          suite.assertTrue( ccm.helper.isInDOM( suite.node, suite.root ) );
        }
      }
    },
    isProxy: {
      tests: {
        'pseudoProxy': function ( suite ) {
          var value = { component: 'ccm.blank.js' };
          suite.assertTrue( ccm.helper.isProxy( value ) );
        },
        /*
        'realProxy': function ( suite ) {
          ccm.instance( '../blank_chat/ccm.blank_chat.js', {
            //instance_a: [ 'ccm.proxy', '../blank/ccm.blank.js' ],
            //instance_b: [ 'ccm.instance', '../chat/ccm.chat.js' ]
          }, function ( instance ) {
            console.log( instance );
            return suite.failed();
            if ( !ccm.helper.isProxy( instance.instance_a ) ) return suite.failed( 'instance a must be a proxy' );
            if (  ccm.helper.isProxy( instance.instance_b ) ) return suite.failed( 'instance b should not be a proxy' );
            suite.passed();
          } );
        },
        */
        'noProxy': function ( suite ) {
          if ( ccm.helper.isProxy( true      ) ) return suite.failed(      "boolean can't be a ccm proxy instance." );
          if ( ccm.helper.isProxy( 1         ) ) return suite.failed(       "number can't be a ccm proxy instance." );
          if ( ccm.helper.isProxy( false     ) ) return suite.failed(  "falsy value can't be a ccm proxy instance." );
          if ( ccm.helper.isProxy( null      ) ) return suite.failed(  "falsy value can't be a ccm proxy instance." );
          if ( ccm.helper.isProxy( undefined ) ) return suite.failed(  "falsy value can't be a ccm proxy instance." );
          if ( ccm.helper.isProxy( 0         ) ) return suite.failed(  "falsy value can't be a ccm proxy instance." );
          if ( ccm.helper.isProxy( ''        ) ) return suite.failed(  "falsy value can't be a ccm proxy instance." );
          if ( ccm.helper.isProxy( []        ) ) return suite.failed(        "array can't be a ccm proxy instance." );
          if ( ccm.helper.isProxy( {}        ) ) return suite.failed( "empty object can't be a ccm proxy instance." );
          if ( ccm.helper.isProxy( { component: {} } ) ) return suite.failed( "object with object in component property can't be a ccm proxy instance." );
          if ( ccm.helper.isProxy( { component: '' } ) ) return suite.failed( "object with empty string in component property can't be a ccm proxy instance." );
          suite.passed();
        }
      }
    },
    isSubset: {
      setup: function ( suite, callback ) {
        suite.other = {
          name: 'John Doe',
          counter: 3,
          isValid: true,
          values: [ 'abc', 123, false ],
          settings: { title: 'Welcome!', year: 2017, greedy: true },
          onLoad: function () { console.log( 'Loading..' ); }
        };
        callback();
      },
      tests: {
        'correctUpperSubset': function ( suite ) {
          suite.assertTrue( ccm.helper.isSubset( {
            name: 'John Doe',
            counter: 3,
            isValid: true
          }, suite.other ) );
        },
        'correctLowerSubset': function ( suite ) {
          suite.assertTrue( ccm.helper.isSubset( {
            values: [ 'abc', 123, false ],
            settings: { title: 'Welcome!', year: 2017, greedy: true },
            onLoad: suite.other.onLoad
          }, suite.other ) );
        },
        'correctSingleProperties': function ( suite ) {
          if ( !ccm.helper.isSubset( { name: 'John Doe' }, suite.other ) ) return suite.failed( 'correct string property must be match'  );
          if ( !ccm.helper.isSubset( { counter: 3       }, suite.other ) ) return suite.failed( 'correct number property must be match'  );
          if ( !ccm.helper.isSubset( { isValid: true    }, suite.other ) ) return suite.failed( 'correct boolean property must be match' );
          if ( !ccm.helper.isSubset( { values:   [ 'abc', 123, false ] },                           suite.other ) ) return suite.failed( 'correct array property must be match' );
          if ( !ccm.helper.isSubset( { settings: { title: 'Welcome!', year: 2017, greedy: true } }, suite.other ) ) return suite.failed( 'correct object property must be match' );
          if ( !ccm.helper.isSubset( { onLoad:   suite.other.onLoad },                              suite.other ) ) return suite.failed( 'correct function property must be match' );
          suite.passed();
        },
        'incorrectSingleProperties': function ( suite ) {
          if ( ccm.helper.isSubset( { name: 'Doe, John' }, suite.other ) ) return suite.failed( 'incorrect string property should not match'  );
          if ( ccm.helper.isSubset( { counter: 2        }, suite.other ) ) return suite.failed( 'incorrect number property should not match'  );
          if ( ccm.helper.isSubset( { isValid: false    }, suite.other ) ) return suite.failed( 'incorrect boolean property should not match' );
          if ( ccm.helper.isSubset( { values:   [ 'xyz', 123, false ] },                                suite.other ) ) return suite.failed( 'incorrect array property should not match' );
          if ( ccm.helper.isSubset( { settings: { title: 'Hello, world.', year: 2017, greedy: true } }, suite.other ) ) return suite.failed( 'incorrect object property should not match' );
          if ( ccm.helper.isSubset( { onLoad:   function () { console.log( 'Loading..' ); } },          suite.other ) ) return suite.failed( 'incorrect function property should not match' );
          suite.passed();
        }
      }
    },
    makeIterable: {
      tests: {
        'notIterableArguments': function ( suite ) {
          suite.assertFalse( typeof arguments.map === 'function' );
        },
        'iterableArguments': function ( suite ) {
          suite.assertTrue( typeof ccm.helper.makeIterable( arguments ).map === 'function' );
        },
        'notIterableElements': function ( suite ) {
          if ( ccm.helper.isGoogleChrome() )
            suite.assertFalse( typeof document.head.children.map === 'function' );
          else
            suite.assertTrue( typeof document.head.children.map === 'function' );
        },
        'iterableElements': function ( suite ) {
          suite.assertTrue( typeof ccm.helper.makeIterable( document.head.children ).map === 'function' );
        },
        'notIterableAttributes': function ( suite ) {
          suite.assertFalse( typeof document.head.attributes.map === 'function' );
        },
        'iterableAttributes': function ( suite ) {
          suite.assertTrue( typeof ccm.helper.makeIterable( document.head.attributes ).map === 'function' );
        }
      }
    },
    noScript: {
      tests: {
        'preventXSS': function ( suite ) {
          suite.assertSame( 'Hello, world!', ccm.helper.noScript( 'Hello, world!<script type="text/javascript">alert("XSS");</script>' ) );
        },
        'preventDeeperXSS': function ( suite ) {
          suite.assertSame( '<span>Hello, world!</span>', ccm.helper.noScript( '<span>Hello, world!<script type="text/javascript">alert("XSS");</script></span>' ) );
        }
      }
    },
    privatize: {
      tests: {
        'someProperties': function ( suite ) {
          var component = ccm.component( {
            name: 'dummy1',
            config: { foo: 'abc', bar: 'xyz' },
            Instance: function () {
              var self = this;
              var my;
              this.ready = function ( callback ) {
                my = ccm.helper.privatize( self, 'childNodes', 'component', 'bar', 'baz', 'id', 'index', 'init', 'ready', 'render' );
                if ( Object.keys( my ).length !== 1 || my.bar !== 'xyz' ) suite.failed( 'wrong privatized properties: ' + JSON.stringify( my ) );
                callback();
              };
            }
          } );
          var instance = component.instance();
          if ( instance.foo !== 'abc' ) suite.failed( 'no public property "foo" with value "abc"' );
          suite.assertEquals( [ 'foo', 'id', 'index', 'component' ], Object.keys( instance ) );
        },
        'allProperties': function ( suite ) {
          var component = ccm.component( {
            name: 'dummy2',
            config: { foo: 'abc', bar: 'xyz' },
            Instance: function () {
              var self = this;
              var my;
              this.ready = function ( callback ) {
                my = ccm.helper.privatize( self );
                if ( Object.keys( my ).length !== 2 || my.foo !== 'abc' || my.bar !== 'xyz' ) suite.failed( 'wrong privatized properties: ' + JSON.stringify( my ) );
                callback();
              };
            }
          } );
          var instance = component.instance( { baz: [ ccm.instance, 'dummy2' ] } );
          suite.assertEquals( [ 'baz', 'id', 'index', 'component' ], Object.keys( instance ) );
        }
      }
    },
    regex: {
      tests: {
        'validFilename': function ( suite ) {
          suite.assertTrue( ccm.helper.regex( 'filename' ).test( 'ccm.dummy-3.2.1.min.js' ) );
        },
        'invalidFilename': function ( suite ) {
          suite.assertFalse( ccm.helper.regex( 'filename' ).test( 'dummy.js' ) );
        },
        'validKey': function ( suite ) {
          suite.assertTrue( ccm.helper.regex( 'key' ).test( 'Dummy12_Foo3' ) );
        },
        'invalidKey': function ( suite ) {
          suite.assertFalse( ccm.helper.regex( 'key' ).test( '' ) || ccm.helper.regex( 'key' ).test( '$' ) );
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