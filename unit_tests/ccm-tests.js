/**
 * @overview tests for <i>ccm</i> framework
 * @author André Kless <andre.kless@web.de> 2016-2017
 * @license The MIT License (MIT)
 */

ccm.files[ 'ccm-tests.js' ] = {
  setup: function ( suite, callback ) {
    suite.ccm.clear();
    callback();
  },
  load: {
    html: {
      setup: function ( suite, callback ) {
        suite.expected_html_result = '<span>Hello, <b>World</b>!</span><br>\n<i>This is only a test file.</i>';
        callback();
      },
      tests: {
        /*
        'localViaHtmlFile': function ( suite ) {
          suite.ccm.load( 'dummy/dummy.html', function ( result ) {
            suite.assertSame( suite.expected_html_result, result );
          } );
        },
        'localViaJsFile': function ( suite ) {
          suite.ccm.load( 'dummy/dummy_html.js', function ( result ) {
            suite.assertSame( suite.expected_html_result, result );
          } );
        },
        */
        'remoteViaJsFile': function ( suite ) {
          suite.ccm.load( 'https://akless.github.io/ccm/unit_tests/dummy/dummy_html.js', function ( result ) {
            suite.assertSame( suite.expected_html_result, result );
          } );
        }/*,
        'cached': function ( suite ) {
          suite.ccm.load( 'dummy/dummy.html', function () {
            var local_cached_return_value = suite.ccm.load( 'dummy/dummy.html' );
            suite.assertSame( suite.expected_html_result, local_cached_return_value );
          } );
        },
        'ignoreCache': function ( suite ) {
          suite.ccm.load( 'dummy/dummy.html', function () {
            var local_cached_return_value = suite.ccm.load( { url: 'dummy/dummy.html', ignore_cache: true } );
            suite.assertNotSame( suite.expected_html_result, local_cached_return_value );
          } );
        }
        */
      }
    },
    css: {
      tests: {
        /*
        'local': function ( suite ) {
          suite.ccm.load( 'dummy/dummy.css', function ( result ) {
            suite.assertSame( 'dummy/dummy.css', result );
          } );
        },
        */
        'remote': function ( suite ) {
          suite.ccm.load( 'https://akless.github.io/ccm/unit_tests/dummy/dummy.css', function ( result ) {
            suite.assertSame( 'https://akless.github.io/ccm/unit_tests/dummy/dummy.css', result );
          } );
        },
        'cached': function ( suite ) {
          suite.ccm.load( 'https://akless.github.io/ccm/unit_tests/dummy/dummy.css', function () {
            var local_cached_return_value = suite.ccm.load( 'https://akless.github.io/ccm/unit_tests/dummy/dummy.css' );
            suite.assertSame( 'https://akless.github.io/ccm/unit_tests/dummy/dummy.css', local_cached_return_value );
          } );
        }
      }
    },
    image: {
      tests: {
        /*
        'local': function ( suite ) {
          suite.ccm.load( 'dummy/dummy.png', function ( result ) {
            suite.assertSame( 'dummy/dummy.png', result );
          } );
        },
        */
        'remote': function ( suite ) {
          suite.ccm.load( 'https://kaul.inf.h-brs.de/ccm/img/config.png', function ( result ) {
            suite.assertSame( 'https://kaul.inf.h-brs.de/ccm/img/config.png', result );
          } );
        },
        'cached': function ( suite ) {
          suite.ccm.load( 'https://kaul.inf.h-brs.de/ccm/img/config.png', function () {
            var local_cached_return_value = suite.ccm.load( 'https://kaul.inf.h-brs.de/ccm/img/config.png' );
            suite.assertSame( 'https://kaul.inf.h-brs.de/ccm/img/config.png', local_cached_return_value );
          } );
        }
      }
    },
    js: {
      tests: {
        /*
        'local': function ( suite ) {
          suite.ccm.load( 'dummy/dummy.js', function ( result ) {
            suite.assertSame( 'dummy/dummy.js', result );
          } );
        },
        */
        'remote': function ( suite ) {
          suite.ccm.load( 'https://kaul.inf.h-brs.de/ccm/lib/jquery.js', function ( result ) {
            suite.assertSame( 'https://kaul.inf.h-brs.de/ccm/lib/jquery.js', result );
          } );
        },
        'cached': function ( suite ) {
          suite.ccm.load( 'https://kaul.inf.h-brs.de/ccm/lib/jquery.js', function () {
            var local_cached_return_value = suite.ccm.load( 'https://kaul.inf.h-brs.de/ccm/lib/jquery.js' );
            suite.assertSame( 'https://kaul.inf.h-brs.de/ccm/lib/jquery.js', local_cached_return_value );
          } );
        },
        'executed': function ( suite ) {
          delete window.jQuery;
          suite.ccm.load( 'https://kaul.inf.h-brs.de/ccm/lib/jquery.js', function () {
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
          suite.assertTrue( suite.ccm.helper.isDatastore( suite.ccm.store() ) );
        },
        'localCallback': function ( suite ) {
          suite.ccm.store( function ( store ) {
            suite.assertTrue( suite.ccm.helper.isDatastore( store ) );
          } );
        },
        'noClientReturn': function ( suite ) {
          suite.assertFalse( suite.ccm.helper.isDatastore( suite.ccm.store( { store: 'test' } ) ) );
        },
        'clientCallback': function ( suite ) {
          suite.ccm.store( { store: 'test' }, function ( store ) {
            suite.assertTrue( suite.ccm.helper.isDatastore( store ) );
          } );
        },
        'serverReturn': function ( suite ) {
          suite.assertTrue( suite.ccm.helper.isDatastore( suite.ccm.store( { url: 'https://ccm.inf.h-brs.de', store: 'test' } ) ) );
        },
        'noServerRealtimeReturn': function ( suite ) {
          suite.assertFalse( suite.ccm.helper.isDatastore( suite.ccm.store( { url: 'wss://ccm.inf.h-brs.de', store: 'test' } ) ) );
        },
        'serverCallback': function ( suite ) {
          suite.ccm.store( { url: 'https://ccm.inf.h-brs.de', store: 'test' }, function ( store ) {
            suite.assertTrue( suite.ccm.helper.isDatastore( store ) );
          } );
        }
      }
    },
    get: {
      local: {
        setup: function ( suite, callback ) {
          suite.store = suite.ccm.store();
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
    arrToObj: {
      tests: {
        'arr': function ( suite ) {
          suite.assertEquals( { foo: true, bar: true }, suite.ccm.helper.arrToObj( [ 'foo', 'bar' ] ) );
        },
        'objKey': function ( suite ) {
          var obj = { arr: [ 'foo', 'bar' ] };
          suite.ccm.helper.arrToObj( obj, 'arr' );
          suite.assertEquals( { foo: true, bar: true }, obj.arr );
        }
      }
    },
    cleanObject: {
      tests: {
        'example': function ( suite ) {
          suite.assertEquals( { foo: 'bar' }, suite.ccm.helper.cleanObject( { foo: 'bar', is: false, i: 0, n: NaN, ref: null, text: '', value: undefined } ) );
        }
      }
    },
    convertObjectKeys: {
      tests: {
        'example': function ( suite ) {
          suite.assertEquals( { test: 123, foo: { bar: 'abc', baz: 'xyz' } }, suite.ccm.helper.convertObjectKeys( { test: 123, 'foo.bar': 'abc', 'foo.baz': 'xyz' } ) );
        }
      }
    },
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
          suite.assertSame( 'abc', suite.ccm.helper.deepValue( obj, 'foo.bar' ) );
        },
        'setObject': function ( suite ) {
          var obj = {};
          suite.ccm.helper.deepValue( obj, 'foo.bar', 'abc' );
          suite.assertEquals( { foo: { bar: 'abc' } }, obj );
        },
        'setReturn': function ( suite ) {
          var obj = {};
          suite.assertSame( 'abc', suite.ccm.helper.deepValue( obj, 'foo.bar', 'abc' ) );
        }
      }
    },
    isProxy: {
      tests: {
        'pseudoProxy': function ( suite ) {
          var value = { component: 'ccm.blank.js' };
          suite.assertTrue( suite.ccm.helper.isProxy( value ) );
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
          if ( suite.ccm.helper.isProxy( true      ) ) return suite.failed(      "boolean can't be a ccm proxy instance." );
          if ( suite.ccm.helper.isProxy( 1         ) ) return suite.failed(       "number can't be a ccm proxy instance." );
          if ( suite.ccm.helper.isProxy( false     ) ) return suite.failed(  "falsy value can't be a ccm proxy instance." );
          if ( suite.ccm.helper.isProxy( null      ) ) return suite.failed(  "falsy value can't be a ccm proxy instance." );
          if ( suite.ccm.helper.isProxy( undefined ) ) return suite.failed(  "falsy value can't be a ccm proxy instance." );
          if ( suite.ccm.helper.isProxy( 0         ) ) return suite.failed(  "falsy value can't be a ccm proxy instance." );
          if ( suite.ccm.helper.isProxy( ''        ) ) return suite.failed(  "falsy value can't be a ccm proxy instance." );
          if ( suite.ccm.helper.isProxy( []        ) ) return suite.failed(        "array can't be a ccm proxy instance." );
          if ( suite.ccm.helper.isProxy( {}        ) ) return suite.failed( "empty object can't be a ccm proxy instance." );
          if ( suite.ccm.helper.isProxy( { component: {} } ) ) return suite.failed( "object with object in component property can't be a ccm proxy instance." );
          if ( suite.ccm.helper.isProxy( { component: '' } ) ) return suite.failed( "object with empty string in component property can't be a ccm proxy instance." );
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
          suite.assertTrue( suite.ccm.helper.isSubset( {
            name: 'John Doe',
            counter: 3,
            isValid: true
          }, suite.other ) );
        },
        'correctLowerSubset': function ( suite ) {
          suite.assertTrue( suite.ccm.helper.isSubset( {
            values: [ 'abc', 123, false ],
            settings: { title: 'Welcome!', year: 2017, greedy: true },
            onLoad: suite.other.onLoad
          }, suite.other ) );
        },
        'correctSingleProperties': function ( suite ) {
          if ( !suite.ccm.helper.isSubset( { name: 'John Doe' }, suite.other ) ) return suite.failed( 'correct string property must be match'  );
          if ( !suite.ccm.helper.isSubset( { counter: 3       }, suite.other ) ) return suite.failed( 'correct number property must be match'  );
          if ( !suite.ccm.helper.isSubset( { isValid: true    }, suite.other ) ) return suite.failed( 'correct boolean property must be match' );
          if ( !suite.ccm.helper.isSubset( { values:   [ 'abc', 123, false ] },                           suite.other ) ) return suite.failed( 'correct array property must be match' );
          if ( !suite.ccm.helper.isSubset( { settings: { title: 'Welcome!', year: 2017, greedy: true } }, suite.other ) ) return suite.failed( 'correct object property must be match' );
          if ( !suite.ccm.helper.isSubset( { onLoad:   suite.other.onLoad },                              suite.other ) ) return suite.failed( 'correct function property must be match' );
          suite.passed();
        },
        'incorrectSingleProperties': function ( suite ) {
          if ( suite.ccm.helper.isSubset( { name: 'Doe, John' }, suite.other ) ) return suite.failed( 'incorrect string property should not match'  );
          if ( suite.ccm.helper.isSubset( { counter: 2        }, suite.other ) ) return suite.failed( 'incorrect number property should not match'  );
          if ( suite.ccm.helper.isSubset( { isValid: false    }, suite.other ) ) return suite.failed( 'incorrect boolean property should not match' );
          if ( suite.ccm.helper.isSubset( { values:   [ 'xyz', 123, false ] },                                suite.other ) ) return suite.failed( 'incorrect array property should not match' );
          if ( suite.ccm.helper.isSubset( { settings: { title: 'Hello, world.', year: 2017, greedy: true } }, suite.other ) ) return suite.failed( 'incorrect object property should not match' );
          if ( suite.ccm.helper.isSubset( { onLoad:   function () { console.log( 'Loading..' ); } },          suite.other ) ) return suite.failed( 'incorrect function property should not match' );
          suite.passed();
        }
      }
    },
    loading: {
      setup: function ( suite, callback ) {
        suite.dummy = suite.ccm.instance( { name: 'dummy', Instance: function () { this.render = function () {} } }, suite.ccm.helper.html( {} ) );
        callback();
      },
      tests: {
        'keyframe': function ( suite ) {
          suite.ccm.helper.loading( suite.dummy );
          suite.assertSame( '@keyframes ccm_loading { to { transform: rotate(360deg); } }', suite.dummy.element.parentNode.querySelector( '#ccm_keyframe' ).innerHTML );
        },
        'icon': function ( suite ) {
          suite.assertSame( '<div class="ccm_loading"><div style="display: inline-block; width: 0.5em; height: 0.5em; border: 0.15em solid #009ee0; border-right-color: transparent; border-radius: 50%; animation: ccm_loading 1s linear infinite;"></div></div>', suite.ccm.helper.loading( suite.dummy ).outerHTML );
        }
      }
    },
    makeIterable: {
      tests: {
        'notIterableArguments': function ( suite ) {
          suite.assertFalse( typeof arguments.map === 'function' );
        },
        'iterableArguments': function ( suite ) {
          suite.assertTrue( typeof suite.ccm.helper.makeIterable( arguments ).map === 'function' );
        },
        'notIterableElements': function ( suite ) {
          if ( suite.ccm.helper.isGoogleChrome() )
            suite.assertFalse( typeof document.head.children.map === 'function' );
          else
            suite.assertTrue( typeof document.head.children.map === 'function' );
        },
        'iterableElements': function ( suite ) {
          suite.assertTrue( typeof suite.ccm.helper.makeIterable( document.head.children ).map === 'function' );
        },
        'notIterableAttributes': function ( suite ) {
          suite.assertFalse( typeof document.head.attributes.map === 'function' );
        },
        'iterableAttributes': function ( suite ) {
          suite.assertTrue( typeof suite.ccm.helper.makeIterable( document.head.attributes ).map === 'function' );
        }
      }
    },
    privatize: {
      tests: {
        'someProperties': function ( suite ) {
          var component = suite.ccm.component( {
            name: 'dummy1',
            config: { foo: 'abc', bar: 'xyz' },
            Instance: function () {
              var self = this;
              var my;
              this.ready = function ( callback ) {
                my = suite.ccm.helper.privatize( self, 'childNodes', 'component', 'bar', 'baz', 'id', 'index', 'init', 'ready', 'render' );
                if ( Object.keys( my ).length !== 1 || my.bar !== 'xyz' ) suite.failed( 'wrong privatized properties: ' + JSON.stringify( my ) );
                callback();
              };
            }
          } );
          var instance = component.instance();
          if ( instance.foo !== 'abc' ) suite.failed( 'no public property "foo" with value "abc"' );
          suite.assertEquals( [ 'foo', 'ccm', 'id', 'index', 'component', 'root', 'element', 'dependency' ], Object.keys( instance ) );
        },
        'allProperties': function ( suite ) {
          var component = suite.ccm.component( {
            name: 'dummy2',
            config: { foo: 'abc', bar: 'xyz' },
            Instance: function () {
              var self = this;
              var my;
              this.ready = function ( callback ) {
                my = suite.ccm.helper.privatize( self );
                callback();
              };
            }
          } );
          var instance = component.instance( { baz: [ 'ccm.instance', 'dummy2' ] } );
          suite.assertEquals( [ 'ccm', 'baz', 'id', 'index', 'component', 'root', 'element' ], Object.keys( instance ) );
        }
      }
    },
    regex: {
      tests: {
        'validFilename': function ( suite ) {
          suite.assertTrue( suite.ccm.helper.regex( 'filename' ).test( 'ccm.dummy-3.2.1.min.js' ) );
        },
        'invalidFilename': function ( suite ) {
          suite.assertFalse( suite.ccm.helper.regex( 'filename' ).test( 'dummy.js' ) );
        },
        'validKey': function ( suite ) {
          suite.assertTrue( suite.ccm.helper.regex( 'key' ).test( 'Dummy12_Foo3' ) );
        },
        'invalidKey': function ( suite ) {
          suite.assertFalse( suite.ccm.helper.regex( 'key' ).test( '' ) || suite.ccm.helper.regex( 'key' ).test( '$' ) );
        }
      }
    },
    solveDependency: {
      setup: function ( suite, callback ) {
        suite.url = 'https://akless.github.io/ccm/unit_tests/dummy/dummy.css';
        suite.obj_key = 'dummy';
        callback();
      },
      tests: {
        'callbackResult': function ( suite ) {
          var obj = { dummy: [ 'ccm.load', suite.url ] };
          suite.ccm.helper.solveDependency( obj, suite.obj_key, function ( result ) {
            suite.assertSame( suite.url, result );
          } );
        },
        'noReturnResult': function ( suite ) {
          var obj = { dummy: [ 'ccm.load', suite.url ] };
          var result = suite.ccm.helper.solveDependency( obj, suite.obj_key );
          suite.assertFalse( result );
        },
        'cachedReturnResult': function ( suite ) {
          suite.ccm.load( suite.url, function () {
            var obj = { dummy: [ 'ccm.load', suite.url ] };
            var result = suite.ccm.helper.solveDependency( obj, suite.obj_key );
            suite.assertSame( suite.url, result );
          } );
        }
      }
    },
    toJSON: {
      tests: {
        'example': function ( suite ) {
          suite.assertEquals( {
            ref: null,
            error: null,
            n: 0,
            m: 12,
            empty: '',
            str: 'foo',
            obj_str: 'bar',
            not: false,
            is: true,
            plain: {},
            _class: {},
            node: {},
            many: { 0: {} }
          }, suite.ccm.helper.toJSON( {
            x: undefined,
            ref: null,
            error: NaN,
            n: 0,
            m: 12,
            empty: '',
            str: 'foo',
            obj_str: new String( 'bar' ),
            not: false,
            is: true,
            func: function ( name ) { return 'Hello, ' + name; },
            plain: {},
            _class: new Object(),
            node: document.head,
            many: document.head.querySelectorAll( 'meta' )
          } ) );
        }
      }
    },
    wait: {
      tests: {
        'oneSecond': function ( suite ) {
          var time = new Date().getTime();
          suite.ccm.helper.wait( 500, function () {
            suite.assertSame( 500, Math.floor( ( new Date().getTime() - time ) / 10 ) * 10 );
          } );
        }
      }
    }
  },
  subresource_integrity: {
    tests: {
      'correctHashCSS': function ( suite ) {
        suite.ccm.load( {
          url: 'https://akless.github.io/ccm/unit_tests/dummy/dummy.css',
          attr: {
            integrity: 'sha384-HNXMzuxnB28OHU1JLVZfb4YpdyYG4Vso6Hde2TeK4ri6UolkaemI7vClL4SBbNyW',
            crossorigin: 'anonymous'
          }
        }, function ( result ) {
          suite.assertSame( 'https://akless.github.io/ccm/unit_tests/dummy/dummy.css', result );
        } );
      },
      'wrongHashCSS': function ( suite ) {
        var passed;
        suite.ccm.helper.wait( 500, function () { if ( !passed ) suite.passed(); passed = false; } );
        suite.ccm.load( {
          url: 'https://akless.github.io/ccm/unit_tests/dummy/dummy.css',
          attr: {
            integrity: 'sha384-HNXMzuxnB28OHU1JLVZfb4YpdyYG4Vso6Hde2TeK4ri6UolkaemI7vClL4SBbNyX',
            crossorigin: 'anonymous'
          }
        }, function ( result ) {
          if ( passed !== false ) suite.failed( 'correct hash', result );
          passed = true;
        } );
      },
      'correctHashJS': function ( suite ) {
        suite.ccm.load( {
          url: 'https://akless.github.io/ccm/unit_tests/dummy/dummy.js',
          attr: {
            integrity: 'sha384-TKnKV29u7ys0EBy1sBaTn8FNF2IixWLJ71F3+cSaPpzj6trbokB5Gsqm3jG5MTly',
            crossorigin: 'anonymous'
          }
        }, function ( result ) {
          suite.assertSame( 'https://akless.github.io/ccm/unit_tests/dummy/dummy.js', result );
        } );
      },
      'wrongHashJS': function ( suite ) {
        var passed;
        suite.ccm.helper.wait( 500, function () { if ( !passed ) suite.passed(); passed = false; } );
        suite.ccm.load( {
          url: 'https://akless.github.io/ccm/unit_tests/dummy/dummy.js',
          attr: {
            integrity: 'sha384-TKnKV29u7ys0EBy1sBaTn8FNF2IixWLJ71F3+cSaPpzj6trbokB5Gsqm3jG5MTlz',
            crossorigin: 'anonymous'
          }
        }, function ( result ) {
          if ( passed !== false ) suite.failed( 'correct hash', result );
          passed = true;
        } );
      }
    }
  }
};