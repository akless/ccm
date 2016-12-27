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
    loading: {
      tests: {
        'keyframe': function ( suite ) {
          var styles = ccm.helper.makeIterable( document.head.getElementsByTagName( 'style' ) );
          for ( var i = 0; i < styles.length; i++ )
            if ( styles[ i ].innerHTML === '@keyframes ccm_loading { to { transform: rotate(360deg); } }' )
              return suite.passed();
          suite.failed( 'missing expected keyframe for ccm loading icon' );
        },
        'icon': function ( suite ) {
          suite.assertSame( '<div class="ccm_loading"><div style="display: inline-block; width: 0.5em; height: 0.5em; border: 0.15em solid #009ee0; border-right-color: transparent; border-radius: 50%; animation: ccm_loading 1s linear infinite;"></div></div>', ccm.helper.loading().outerHTML );
        }
      }
    },
    makeIterable: {
      arguments: {
        tests: {
          'notIterable': function ( suite ) {
            dummy( 'foo', 'bar', 'baz' );
            function dummy() {
              suite.assertNotEquals( [ 'foo', 'bar', 'baz' ], arguments );
            }
          },
          'iterable': function ( suite ) {
            dummy( 'foo', 'bar', 'baz' );
            function dummy() {
              suite.assertEquals( [ 'foo', 'bar', 'baz' ], ccm.helper.makeIterable( arguments ) );
            }
          }
        }
      },
      children: {
        setup: function ( suite, callback ) {
          suite.parent = document.createElement( 'div' );
          suite.child1 = document.createElement( 'span' );
          suite.child2 = document.createElement( 'p' );
          suite.child3 = document.createElement( 'a' );
          suite.parent.appendChild( suite.child1 );
          suite.parent.appendChild( suite.child2 );
          suite.parent.appendChild( suite.child3 );
          callback();
        },
        tests: {
          'notIterable': function ( suite ) {
            suite.assertNotEquals( [ suite.child1, suite.child2, suite.child3 ], suite.parent.children );
          },
          'iterable': function ( suite ) {
            suite.assertEquals( [ suite.child1, suite.child2, suite.child3 ], ccm.helper.makeIterable( suite.parent.children ) );
          }
        }
      },
      attributes: {
        setup: function ( suite, callback ) {
          suite.parent = document.createElement( 'div' );
          suite.attr_1 = document.createAttribute( 'id' );
          suite.attr_2 = document.createAttribute( 'class' );
          suite.attr_3 = document.createAttribute( 'title' );
          suite.parent.setAttributeNode( suite.attr_1 );
          suite.parent.setAttributeNode( suite.attr_2 );
          suite.parent.setAttributeNode( suite.attr_3 );
          callback();
        },
        tests: {
          'notIterable': function ( suite ) {
            suite.assertNotEquals( [ suite.attr_1, suite.attr_2, suite.attr_3 ], suite.parent.attributes );
          },
          'iterable': function ( suite ) {
            suite.assertEquals( [ suite.attr_1, suite.attr_2, suite.attr_3 ], ccm.helper.makeIterable( suite.parent.attributes ) );
          }
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
                my = ccm.helper.privatize( self, 'childNodes', 'component', 'element', 'bar', 'baz', 'id', 'index', 'init', 'ready', 'render' );
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
          suite.assertTrue( ccm.helper.regex( 'key' ).test( 'dummy12_Foo3' ) );
        },
        'invalidKey': function ( suite ) {
          suite.assertFalse( ccm.helper.regex( 'key' ).test( 'Dummy' ) );
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