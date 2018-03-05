/**
 * @overview unit tests for the ccm framework
 * @author André Kless <andre.kless@web.de> 2016-2018
 * @license The MIT License (MIT)
 */

ccm.files[ 'ccm-tests.js' ] = {
  setup: ( suite, callback ) => {
    suite.ccm.clear();
    suite.$ = suite.ccm.helper;
    callback();
  },
  load: {
    html: {
      setup: ( suite, callback ) => {
        suite.local = 'dummy/hello.html';
        suite.expected = 'Hello, <b>World</b>!';
        callback();
      },
      tests: {
        'local': suite => suite.ccm.load( suite.local, result => suite.assertSame( suite.expected, result ) ),
        'sop': suite => {
          let finished = false;
          suite.ccm.load( 'http://fh-lsoopjava.de/' + suite.local, () => { if ( !finished ) suite.failed( 'broken SOP security' ); finished = true; } );
          suite.ccm.helper.wait( 300, () => { if ( !finished ) return suite.passed(); finished = true; } );
        },
        'cors': suite => suite.ccm.load( 'https://akless.github.io/ccm/unit_tests/' + suite.local, result => suite.assertSame( suite.expected, result ) ),
        'remote': suite => suite.ccm.load( 'https://kaul.inf.h-brs.de/ccm/dummy/html.js', result => suite.assertSame( suite.expected, result ) ),
        'cached': suite => suite.ccm.load( suite.local, () => suite.assertSame( suite.expected, suite.ccm.load( { url: suite.local, ignore_cache: false } ) ) ),
        'notCached': suite => suite.assertSame( undefined, suite.ccm.load( suite.local ) ),
        'ignoreCache': suite => suite.ccm.load( suite.local, () => suite.assertSame( undefined, suite.ccm.load( { url: suite.local, ignore_cache: true } ) ) ),
        'get': suite => suite.ccm.load( { url: suite.local, method: 'GET' }, result => suite.assertSame( suite.expected, result ) ),
        'post': suite => {
          let finished = false;
          suite.ccm.load( { url: suite.local, method: 'POST' }, result => { if ( !finished ) suite.assertSame( suite.expected, result ); finished = true; } );
          suite.ccm.helper.wait( 300, () => { if ( !finished ) return suite.ccm.helper.isFirefox() ? suite.passed() : suite.failed(); finished = true; } );
        },
        'params': suite => suite.ccm.load( { url: suite.local, params: { foo: 'bar' } }, result => suite.assertSame( suite.expected, result ) )
      }
    },
    css: {
      setup: ( suite, callback ) => {
        suite.local = 'dummy/style.css';
        suite.check = ( url, context ) => ( context || document ).querySelector( 'link[href="' + url + '"]' );
        suite.msg = 'already present';
        callback();
      },
      tests: {
        'local': suite => {
          if ( suite.check( suite.local ) ) return suite.failed( suite.msg );
          suite.ccm.load( suite.local, () => suite.assertTrue( suite.check( suite.local, document.head ) ) );
        },
        'remote': suite => {
          suite.remote = 'https://kaul.inf.h-brs.de/ccm/' + suite.local;
          if ( suite.check( suite.remote ) ) return suite.failed( suite.msg );
          suite.ccm.load( suite.remote, () => suite.assertTrue( suite.check( suite.remote, document.head ) ) );
        },
        'returnValue': suite => suite.ccm.load( suite.local, result => suite.assertSame( suite.local, result ) ),
        'cached': suite => suite.ccm.load( suite.local, () => suite.assertSame( suite.local, suite.ccm.load( suite.local ) ) ),
        'notCached': suite => {
          if ( suite.check( suite.local ) ) return suite.failed( suite.msg );
          suite.assertSame( undefined, suite.ccm.load( suite.local ) );
        },
        'ignoreCache': suite => suite.ccm.load( suite.local, () => suite.assertSame( undefined, suite.ccm.load( { url: suite.local, ignore_cache: true } ) ) ),
        'noCacheContext': suite => suite.ccm.load( suite.local, () => suite.assertSame( undefined, suite.ccm.load( { url: suite.local, context: document.body } ) ) ),
        'context': suite => {
          if ( suite.check( suite.local ) ) return suite.failed( suite.msg );
          let element = document.createElement( 'div' );
          document.body.appendChild( element );
          suite.ccm.load( { url: suite.local, context: element }, () => {
            if ( suite.check( suite.local, document.head ) ) return suite.failed( suite.msg );
            suite.assertTrue( suite.check( suite.local, element ) );
          } );
        },
        'on-the-fly': suite => {
          if ( suite.check( suite.local ) ) return suite.failed( suite.msg );
          let finished = false;
          let element = document.createElement( 'div' );
          suite.ccm.load( { url: suite.local, context: element }, () => { if ( !finished ) suite.failed( 'CSS loaded on-the-fly' ); finished = true; } );
          suite.ccm.helper.wait( 300, () => { if ( !finished ) return suite.passed(); finished = true; } );
        },
        'head': suite => {
          if ( suite.check( suite.local ) ) return suite.failed( suite.msg );
          suite.ccm.load( { url: suite.local, context: 'head' }, () => {
            suite.assertTrue( suite.check( suite.local, document.head ) );
          } );
        },
        'shadow': suite => {
          let shadow = document.createElement( 'div' );
          document.body.appendChild( shadow );
          shadow = shadow.attachShadow( { mode: 'open' } );
          suite.ccm.load( { url: suite.local, context: shadow }, () => {
            if ( suite.check( suite.local ) ) return suite.failed( suite.msg );
            suite.assertTrue( suite.check( suite.local, shadow ) );
          } );
        },
        'instance': suite => {
          if ( suite.check( suite.local ) ) return suite.failed( suite.msg );
          const element = document.createElement( 'div' );
          document.body.appendChild( element );
          suite.ccm.instance( { name: 'dummy', ccm: '../ccm.js', Instance: function () {} }, element, instance => suite.ccm.load( { url: suite.local, context: instance }, () => {
            if ( suite.check( suite.local ) ) return suite.failed( suite.msg );
            suite.assertTrue( suite.check( suite.local, instance.element.parentNode ) );
          } ) );
        }
      }
    },
    image: {
      setup: ( suite, callback ) => {
        suite.local = 'dummy/image.png';
        callback();
      },
      tests: {
        'local': suite => suite.ccm.load( suite.local, result => suite.assertSame( suite.local, result ) ),
        'remote': suite => {
          const remote = 'https://kaul.inf.h-brs.de/ccm/' + suite.local;
          suite.ccm.load( remote, result => suite.assertSame( remote, result ) );
        },
        'cached': suite => suite.ccm.load( suite.local, () => suite.assertSame( suite.local, suite.ccm.load( suite.local ) ) ),
        'notCached': suite => suite.assertSame( undefined, suite.ccm.load( suite.local ) ),
        'ignoreCache': suite => suite.ccm.load( suite.local, () => suite.assertSame( undefined, suite.ccm.load( { url: suite.local, ignore_cache: true } ) ) )
      }
    },
    json: {
      setup: ( suite, callback ) => {
        suite.local = 'dummy/data.json';
        suite.expected = { foo: 'bar' };
        callback();
      },
      tests: {
        'local': suite => suite.ccm.load( suite.local, result => suite.assertEquals( suite.expected, result ) ),
        'sop': suite => {
          let finished = false;
          suite.ccm.load( 'http://fh-lsoopjava.de/' + suite.local, () => { if ( !finished ) suite.failed( 'broken SOP security' ); finished = true; } );
          suite.ccm.helper.wait( 300, () => { if ( !finished ) return suite.passed(); finished = true; } );
        },
        'cors': suite => suite.ccm.load( 'https://akless.github.io/ccm/unit_tests/' + suite.local, result => suite.assertEquals( suite.expected, result ) ),
        'cached': suite => suite.ccm.load( suite.local, () => suite.assertEquals( suite.expected, suite.ccm.load( { url: suite.local, ignore_cache: false } ) ) ),
        'notCached': suite => suite.assertSame( undefined, suite.ccm.load( suite.local ) ),
        'ignoreCache': suite => suite.ccm.load( suite.local, () => suite.assertSame( undefined, suite.ccm.load( { url: suite.local, ignore_cache: true } ) ) ),
        'get': suite => suite.ccm.load( { url: suite.local, method: 'GET' }, result => suite.assertEquals( suite.expected, result ) ),
        'post': suite => {
          let finished = false;
          suite.ccm.load( { url: suite.local, method: 'POST' }, result => { if ( !finished ) suite.assertEquals( suite.expected, result ); finished = true; } );
          suite.ccm.helper.wait( 300, () => { if ( !finished ) return suite.ccm.helper.isFirefox() ? suite.passed() : suite.failed(); finished = true; } );
        },
        'params': suite => suite.ccm.load( { url: suite.local, params: { foo: 'bar' } }, result => suite.assertEquals( suite.expected, result ) )
      }
    },
    js: {
      setup: ( suite, callback ) => {
        suite.local = 'dummy/script.js';
        suite.expected = { foo: 'bar' };
        callback();
      },
      tests: {
        'local': suite => suite.ccm.load( suite.local, result => suite.assertEquals( suite.expected, result ) ),
        'remote': suite => suite.ccm.load( 'https://kaul.inf.h-brs.de/ccm/' + suite.local, result => suite.assertEquals( suite.expected, result ) ),
        'cached': suite => suite.ccm.load( suite.local, () => suite.assertEquals( suite.expected, suite.ccm.load( suite.local ) ) ),
        'notCached': suite => suite.assertSame( undefined, suite.ccm.load( suite.local ) ),
        'ignoreCache': suite => suite.ccm.load( suite.local, () => suite.assertSame( undefined, suite.ccm.load( { url: suite.local, ignore_cache: true } ) ) ),
        'min': suite => suite.ccm.load( 'dummy/script.min.js', result => suite.assertEquals( suite.expected, result ) )
      }
    },
    data: {
      setup: ( suite, callback ) => {
        suite.url = 'https://kaul.inf.h-brs.de/ccm/dummy/hello.php';
        suite.expected = 'Hello, World!';
        callback();
      },
      tests: {
        'default': suite => suite.ccm.load( suite.url, result => suite.assertSame( suite.expected, result ) ),
        'get':   suite => suite.ccm.load( { url: suite.url, params: { name: 'World' }, method: 'GET'  }, result => suite.assertSame( suite.expected, result ) ),
        'post':  suite => suite.ccm.load( { url: suite.url, params: { name: 'World' }, method: 'POST' }, result => suite.assertSame( suite.expected, result ) ),
        'jsonp': suite => suite.ccm.load( { url: suite.url, params: { name: 'World' }, jsonp :  true  }, result => suite.assertSame( suite.expected, result ) ),
        'notCached': suite => suite.ccm.load( suite.url, () => suite.assertSame( undefined, suite.ccm.load( suite.url ) ) ),
        'demoLogin': suite => suite.ccm.load( {
          url: 'https://ccm.inf.h-brs.de',
          method: 'JSONP',
          params: { realm: 'ccm' },
        }, result => suite.assertEquals( [ 'id', 'token' ], Object.keys( result ) ) )
      }
    },
    type: {
      setup: ( suite, callback ) => {
        suite.url = 'https://kaul.inf.h-brs.de/ccm/dummy/';
        callback();
      },
      tests: {
         'staticHTML' : suite => suite.ccm.load(                    'dummy/html'                 , result => suite.assertSame  (  'Hello, <b>World</b>!', result ) ),
        'dynamicHTML' : suite => suite.ccm.load(        suite.url +   'html.php'                 , result => suite.assertSame  (  'Hello, <b>World</b>!', result ) ),
        'dynamicCSS'  : suite => suite.ccm.load( { url: suite.url +    'css.php', type: 'css'   }, result => suite.assertSame  ( suite.url +   'css.php', result ) ),
        'dynamicImage': suite => suite.ccm.load( { url: suite.url +  'image.php', type: 'image' }, result => suite.assertSame  ( suite.url + 'image.php', result ) ),
         'staticData' : suite => suite.ccm.load(                    'dummy/data'                 , result => suite.assertEquals(          { foo: 'bar' }, result ) ),
        'dynamicData' : suite => suite.ccm.load(        suite.url +   'data.php'                 , result => suite.assertEquals(          { foo: 'bar' }, result ) ),
          'jsonpData' : suite => suite.ccm.load( { url: suite.url +   'data.php', jsonp: true   }, result => suite.assertEquals(          { foo: 'bar' }, result ) ),
        'dynamicJS'   : suite => suite.ccm.load( { url: suite.url +     'js.php', type: 'js'    }, result => suite.assertEquals(          { foo: 'bar' }, result ) )
      }
    },
    subresource_integrity: {
      setup: ( suite, callback ) => {
        suite.url = 'dummy/';
        callback();
      },
      tests: {
        'correctHashCSS': suite => suite.ccm.load( {
          url: suite.url + 'style.css',
          attr: {
            integrity: 'sha384-TNlMHgEvh4ObcFIulNi29adH0Fz/RRputWGgEk/ZbfIzua6sHbLCReq+SZ4nfISA',
            crossorigin: 'anonymous'
          }
        }, result => suite.assertSame( suite.url + 'style.css', result ) ),
        'wrongHashCSS': suite => {
          let finished = false;
          suite.ccm.helper.wait( 300, () => { if ( !finished ) suite.passed(); finished = true; } );
          suite.ccm.load( {
            url: suite.url + 'style.css',
            attr: {
              integrity: 'sha384-TNlMHgEvh4ObcFIulNi29adH0Fz/RRputWGgEk/ZbfIzua6sHbLCReq+SZ4nfISB',
              crossorigin: 'anonymous'
            }
          }, result => {
            if ( !finished )
              if ( suite.ccm.helper.isSafari() || suite.ccm.helper.isFirefox() )
                suite.assertSame( suite.url + 'style.css', result );
              else
                suite.failed( 'correct hash', result );
            finished = true;
          } );
        },
        'correctHashJS': suite => {
          suite.ccm.load( {
            url: suite.url + 'script.js',
            attr: {
              integrity: 'sha384-QoLtnRwWkKw2xXw4o/pmW2Z1Zwst5f16sRMbRfP/Ova1nnEN6t2xUwiLOZ7pbbDW',
              crossorigin: 'anonymous'
            }
          }, result => suite.assertEquals( { foo: 'bar' }, result ) );
        },
        'wrongHashJS': suite => {
          let finished = false;
          suite.ccm.helper.wait( 300, () => { if ( !finished ) suite.passed(); finished = true; } );
          suite.ccm.load( {
            url: suite.url + 'script.js',
            attr: {
              integrity: 'sha384-QoLtnRwWkKw2xXw4o/pmW2Z1Zwst5f16sRMbRfP/Ova1nnEN6t2xUwiLOZ7pbbDX',
              crossorigin: 'anonymous'
            }
          }, result => {
            if ( !finished )
              if ( suite.ccm.helper.isSafari() || suite.ccm.helper.isFirefox() )
                suite.assertEquals( { foo: 'bar' }, result );
              else
                suite.failed( 'correct hash', result );
            finished = true;
          } );
        }
      }
    },
    tests: {
      'callback': suite => suite.ccm.load( suite.passed ),
      'clone': suite => {
        const resource = { url: 'dummy/hello.html' };
        suite.ccm.load( resource, () => suite.assertEquals( { url: 'dummy/hello.html' }, resource ) );
      },
      'array': suite => {
        suite.ccm.load(
          'dummy/hello.html',
          [
            'dummy/style.css',
            'dummy/image.png',
            [
              'dummy/data.json',
              'dummy/script.js'
            ],
            'dummy/logo.gif'
          ],
          'dummy/picture.jpg',
          result => suite.assertEquals( [
            'Hello, <b>World</b>!',
            [
              'dummy/style.css',
              'dummy/image.png',
              [
                { foo: 'bar' },
                { foo: 'bar' }
              ],
              'dummy/logo.gif'
            ],
            'dummy/picture.jpg'
          ], result )
        );
      }
    }
  },
  store: {
    create: {
      tests: {
        'local': function ( suite ) {
          suite.ccm.store( {}, function ( store ) {
            suite.assertTrue( suite.ccm.helper.isDatastore( store ) );
          } );
        },
        'client': function ( suite ) {
          suite.ccm.store( { store: 'test' }, function ( store ) {
            suite.assertTrue( suite.ccm.helper.isDatastore( store ) );
          } );
        },
        'server': function ( suite ) {
          suite.ccm.store( { url: 'https://ccm.inf.h-brs.de', store: 'test' }, function ( store ) {
            suite.assertTrue( suite.ccm.helper.isDatastore( store ) );
          } );
        }
      }
    },
    get: {
      /*,
      local: {
        setup: ( suite, callback ) => suite.store = suite.ccm.store( store => callback( suite.store = store ) ),
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
    fillForm: {
      input: {
        tests: {
          'color': suite => {
            const form = suite.$.html( { inner: { tag: 'input', type: 'color', name: 'x' } } );
            const input = form.querySelector( 'input' );
            suite.$.fillForm( form, { x: '#66ccff' } );
            suite.assertSame( '#66ccff', input.value );
          },
          'date': suite => {
            const form = suite.$.html( { inner: { tag: 'input', type: 'date', name: 'x' } } );
            const input = form.querySelector( 'input' );
            suite.$.fillForm( form, { x: '2017-11-19' } );
            suite.assertSame( '2017-11-19', input.value );
          },
          'datetime-local': suite => {
            const form = suite.$.html( { inner: { tag: 'input', type: 'datetime-local', name: 'x' } } );
            const input = form.querySelector( 'input' );
            suite.$.fillForm( form, { x: '2017-11-19T09:55' } );
            suite.assertSame( '2017-11-19T09:55', input.value );
          },
          'email': suite => {
            const form = suite.$.html( { inner: { tag: 'input', type: 'email', name: 'x' } } );
            const input = form.querySelector( 'input' );
            suite.$.fillForm( form, { x: 'john.doe@web.de' } );
            suite.assertSame( 'john.doe@web.de', input.value );
          },
          'hidden': suite => {
            const form = suite.$.html( { inner: { tag: 'input', type: 'hidden', name: 'x' } } );
            const input = form.querySelector( 'input' );
            suite.$.fillForm( form, { x: 'secret' } );
            suite.assertSame( 'secret', input.value );
          },
          'month': suite => {
            const form = suite.$.html( { inner: { tag: 'input', type: 'month', name: 'x' } } );
            const input = form.querySelector( 'input' );
            suite.$.fillForm( form, { x: '2017-11' } );
            suite.assertSame( '2017-11', input.value );
          },
          'password': suite => {
            const form = suite.$.html( { inner: { tag: 'input', type: 'password', name: 'x' } } );
            const input = form.querySelector( 'input' );
            suite.$.fillForm( form, { x: 'xxx' } );
            suite.assertSame( 'xxx', input.value );
          },
          'search': suite => {
            const form = suite.$.html( { inner: { tag: 'input', type: 'search', name: 'x' } } );
            const input = form.querySelector( 'input' );
            suite.$.fillForm( form, { x: 'found!' } );
            suite.assertSame( 'found!', input.value );
          },
          'tel': suite => {
            const form = suite.$.html( { inner: { tag: 'input', type: 'tel', name: 'x' } } );
            const input = form.querySelector( 'input' );
            suite.$.fillForm( form, { x: '0123456789' } );
            suite.assertSame( '0123456789', input.value );
          },
          'text': suite => {
            const form = suite.$.html( { inner: { tag: 'input', type: 'text', name: 'x' } } );
            const input = form.querySelector( 'input' );
            suite.$.fillForm( form, { x: 'John Doe' } );
            suite.assertSame( 'John Doe', input.value );
          },
          'time': suite => {
            const form = suite.$.html( { inner: { tag: 'input', type: 'time', name: 'x' } } );
            const input = form.querySelector( 'input' );
            suite.$.fillForm( form, { x: '12:55' } );
            suite.assertSame( '12:55', input.value );
          },
          'url': suite => {
            const form = suite.$.html( { inner: { tag: 'input', type: 'url', name: 'x' } } );
            const input = form.querySelector( 'input' );
            suite.$.fillForm( form, { x: 'https://www.john-doe.de' } );
            suite.assertSame( 'https://www.john-doe.de', input.value );
          },
          'week': suite => {
            const form = suite.$.html( { inner: { tag: 'input', type: 'week', name: 'x' } } );
            const input = form.querySelector( 'input' );
            suite.$.fillForm( form, { x: '2017-W46' } );
            suite.assertSame( '2017-W46', input.value );
          }
        }
      },
      number: {
        tests: {
          'validNumber': suite => {
            const form = suite.$.html( { inner: { tag: 'input', type: 'number', name: 'x' } } );
            const input = form.querySelector( 'input' );
            suite.$.fillForm( form, { x: 3 } );
            suite.assertSame( '3', input.value );
          },
          'invalidNumber': suite => {
            const form = suite.$.html( { inner: { tag: 'input', type: 'number', name: 'x' } } );
            const input = form.querySelector( 'input' );
            suite.$.fillForm( form, { x: 'foo' } );
            suite.assertSame( '', input.value );
          },
          'validRange': suite => {
            const form = suite.$.html( { inner: { tag: 'input', type: 'range', name: 'x', min: 1, max: 12 } } );
            const input = form.querySelector( 'input' );
            suite.$.fillForm( form, { x: 5 } );
            suite.assertSame( '5', input.value );
          },
          'invalidRange': suite => {
            const form = suite.$.html( { inner: { tag: 'input', type: 'range', name: 'x', min: 1, max: 12 } } );
            const input = form.querySelector( 'input' );
            suite.$.fillForm( form, { x: 'foo' } );
            suite.assertNotSame( 'foo', input.value );
          },
          'outOfRange': suite => {
            const form = suite.$.html( { inner: { tag: 'input', type: 'range', name: 'x', min: 1, max: 12 } } );
            const input = form.querySelector( 'input' );
            suite.$.fillForm( form, { x: 5711 } );
            suite.assertNotSame( '5711', input.value );
          }
        }
      },
      checkbox: {
        tests: {
          'singleTrueTrue': suite => {
            const form = suite.$.html( { inner: { tag: 'input', type: 'checkbox', name: 'x' } } );
            const input = form.querySelector( 'input' );
            suite.$.fillForm( form, { x: true } );
            suite.assertSame( 'on', input.value );
          },
          'singleTrueValue': suite => {
            const form = suite.$.html( { inner: { tag: 'input', type: 'checkbox', name: 'x' } } );
            const input = form.querySelector( 'input' );
            suite.$.fillForm( form, { x: 'foo' } );
            suite.assertSame( 'on', input.value );
          },
          'singleValueTrue': suite => {
            const form = suite.$.html( { inner: { tag: 'input', type: 'checkbox', name: 'x', value: 'foo' } } );
            const input = form.querySelector( 'input' );
            suite.$.fillForm( form, { x: true } );
            suite.assertSame( 'foo', input.value );
          },
          'singleValueValue': suite => {
            const form = suite.$.html( { inner: { tag: 'input', type: 'checkbox', name: 'x', value: 'foo' } } );
            const input = form.querySelector( 'input' );
            suite.$.fillForm( form, { x: 'foo' } );
            suite.assertSame( 'foo', input.value );
          },
          'multiWrong': suite => {
            const form = suite.$.html( { inner: [
              { tag: 'input', type: 'checkbox', name: 'x', value: 'foo' },
              { tag: 'input', type: 'checkbox', name: 'x', value: 'bar' }
            ] } );
            const inputs = form.querySelectorAll( 'input' );
            suite.$.fillForm( form, { x: [ 'baz' ] } );
            if ( inputs[ 0 ].checked ) return suite.failed( 'first checkbox is checked' );
            if ( inputs[ 1 ].checked ) return suite.failed( 'second checkbox is checked' );
            return suite.passed();
          },
          'multiSubset': suite => {
            const form = suite.$.html( { inner: [
              { tag: 'input', type: 'checkbox', name: 'x', value: 'foo' },
              { tag: 'input', type: 'checkbox', name: 'x', value: 'bar' }
            ] } );
            const inputs = form.querySelectorAll( 'input' );
            suite.$.fillForm( form, { x: [ 'bar' ] } );
            if (  inputs[ 0 ].checked ) return suite.failed( 'first checkbox is checked' );
            if ( !inputs[ 1 ].checked ) return suite.failed( 'second checkbox is not checked' );
            return suite.passed();
          },
          'singleMultiMix': suite => {
            const form = suite.$.html( { inner: [
              { tag: 'input', type: 'checkbox', name: 'x', value: 'foo' },
              { tag: 'input', type: 'checkbox', name: 'x', value: 'bar' },
              { tag: 'input', type: 'checkbox', name: 'x', value: 'baz' },
              { tag: 'input', type: 'checkbox', name: 'y' },
              { tag: 'input', type: 'checkbox', name: 'z' }
            ] } );
            const inputs = form.querySelectorAll( 'input' );
            suite.$.fillForm( form, { x: [ 'foo', 'bar' ], y: true, z: false } );
            if ( !inputs[ 0 ].checked ) return suite.failed( 'first checkbox is checked' );
            if ( !inputs[ 1 ].checked ) return suite.failed( 'second checkbox is checked' );
            if (  inputs[ 2 ].checked ) return suite.failed( 'third checkbox is not checked' );
            if ( !inputs[ 3 ].checked ) return suite.failed( 'fourth checkbox is not checked' );
            if (  inputs[ 4 ].checked ) return suite.failed( 'fifth checkbox is checked' );
            return suite.passed();
          }
        }
      },
      radio: {
        tests: {
          'wrong': suite => {
            const form = suite.$.html( { inner: [
              { tag: 'input', type: 'radio', name: 'x', value: 'foo' },
              { tag: 'input', type: 'radio', name: 'x', value: 'bar' }
            ] } );
            const inputs = form.querySelectorAll( 'input' );
            suite.$.fillForm( form, { x: 'baz' } );
            if ( inputs[ 0 ].checked ) return suite.failed( 'first radio button is checked' );
            if ( inputs[ 1 ].checked ) return suite.failed( 'second radio button is checked' );
            return suite.passed();
          },
          'correct': suite => {
            const form = suite.$.html( { inner: [
              { tag: 'input', type: 'radio', name: 'x', value: 'foo' },
              { tag: 'input', type: 'radio', name: 'x', value: 'bar' }
            ] } );
            const inputs = form.querySelectorAll( 'input' );
            suite.$.fillForm( form, { x: 'bar' } );
            if (  inputs[ 0 ].checked ) return suite.failed( 'first radio button is checked' );
            if ( !inputs[ 1 ].checked ) return suite.failed( 'second radio button is not checked' );
            return suite.passed();
          }
        }
      },
      select: {
        tests: {
          'singleWrong': suite => {
            const form = suite.$.html( { inner: { tag: 'select', name: 'x', inner: [
              { tag: 'option', value: 'foo' },
              { tag: 'option', value: 'bar' }
            ] } } );
            const options = form.querySelectorAll( 'option' );
            suite.$.fillForm( form, { x: 'baz' } );
            if ( !options[ 0 ].selected ) return suite.failed( 'first entry is not selected' );
            if (  options[ 1 ].selected ) return suite.failed( 'second entry is selected' );
            return suite.passed();
          },
          'singleCorrect': suite => {
            const form = suite.$.html( { inner: { tag: 'select', name: 'x', inner: [
              { tag: 'option', value: 'foo' },
              { tag: 'option', value: 'bar' }
            ] } } );
            const options = form.querySelectorAll( 'option' );
            suite.$.fillForm( form, { x: 'bar' } );
            if (  options[ 0 ].selected ) return suite.failed( 'first entry is selected' );
            if ( !options[ 1 ].selected ) return suite.failed( 'second entry is not selected' );
            return suite.passed();
          },
          'multipleWrong': suite => {
            const form = suite.$.html( { inner: { tag: 'select', multiple: true, name: 'x', inner: [
              { tag: 'option', value: 'foo' },
              { tag: 'option', value: 'bar' }
            ] } } );
            const options = form.querySelectorAll( 'option' );
            suite.$.fillForm( form, { x: [ 'baz' ] } );
            if ( options[ 0 ].selected ) return suite.failed( 'first entry is selected' );
            if ( options[ 1 ].selected ) return suite.failed( 'second entry is selected' );
            return suite.passed();
          },
          'multipleCorrect': suite => {
            const form = suite.$.html( { inner: { tag: 'select', multiple: true, name: 'x', inner: [
              { tag: 'option', value: 'foo' },
              { tag: 'option', value: 'bar' }
            ] } } );
            const options = form.querySelectorAll( 'option' );
            suite.$.fillForm( form, { x: [ 'foo', 'bar' ] } );
            if ( !options[ 0 ].selected ) return suite.failed( 'first entry is not selected' );
            if ( !options[ 1 ].selected ) return suite.failed( 'second entry is not selected' );
            return suite.passed();
          }
        }
      },
      tests: {
        'textarea': suite => {
          const form = suite.$.html( { inner: { tag: 'textarea', name: 'x' } } );
          const input = form.querySelector( 'textarea' );
          suite.$.fillForm( form, { x: 'foo' } );
          suite.assertSame( 'foo', input.value );
        },
        'objectValue': suite => {
          const form = suite.$.html( { inner: { tag: 'input', type: 'text', name: 'x' } } );
          const input = form.querySelector( 'input' );
          suite.$.fillForm( form, { x: { foo: 'bar' } } );
          suite.assertSame( "{'foo':'bar'}", input.value );
        },
        'arrayValue': suite => {
          const form = suite.$.html( { inner: { tag: 'input', type: 'text', name: 'x' } } );
          const input = form.querySelector( 'input' );
          suite.$.fillForm( form, { x: [ 'foo', 'bar' ] } );
          suite.assertSame( "['foo','bar']", input.value );
        },
        'dotNotation': suite => {
          const form = suite.$.html( { inner: { tag: 'input', type: 'text', name: 'x.foo' } } );
          const input = form.querySelector( 'input' );
          suite.$.fillForm( form, { x: { foo: 'bar' } } );
          suite.assertSame( 'bar', input.value );
        }
      }
    },
    format: {
      tests: {
        'obj': function ( suite ) {
          var func = function () {};
          suite.assertEquals(
            {
              is: true,
              abc: {
                xyz: {
                  foo: 'Hello, World!',
                  ping: 'pong',
                  f1: func
                },
                n: 12,
                bar: 4711,
                f2: func
              },
              baz: true,
              a: 'x',
              b: true,
              c: 3,
              d: 'Hello, World!',
              e: 4711,
              f: true,
              func: function () {},
              f3: func
            },
            suite.ccm.helper.format(
              {
                is: '%%',
                abc: {
                  xyz: {
                    foo: '%text%',
                    ping: '%%',
                    f1: '%func%'
                  },
                  n: '%%',
                  bar: '%number%',
                  f2: '%func%'
                },
                baz: '%bool%',
                a: 'x',
                b: true,
                c: 3,
                d: '%text%',
                e: '%number%',
                f: '%bool%',
                func: function () {},
                f3: '%func%'
              },
              true,
              'pong',
              {
                text: 'Hello, World!',
                number: 4711,
                bool: true,
                func: func
              },
              12
            )
          );
        },
        'string': function ( suite ) {
          suite.assertEquals(
            'true, Hello, World!, pong, 12, 4711, true',
            suite.ccm.helper.format( '%%, %text%, %%, %%, %number%, %bool%',
              true,
              'pong',
              {
                text: 'Hello, World!',
                number: 4711,
                bool: true
              },
              12
            )
          );
        },
        'func': function ( suite ) {
          var func = function () {};
          if ( func !== suite.ccm.helper.format(           func     )     ) return suite.failed();
          if ( func !== suite.ccm.helper.format( { x:      func   } ).x   ) return suite.failed();
          if ( func !== suite.ccm.helper.format( { x: { y: func } } ).x.y ) return suite.failed();
          var result;
          result = suite.ccm.helper.format( { f1: '%func%', f2: '%func%', f3: '%func%' }, { func: func } );
          if ( func !== result.f1 || func !== result.f2 || func !== result.f3 ) return suite.failed();
          result = suite.ccm.helper.format( { f1: '%%', f2: '%%', f3: '%%' }, func, func, func );
          if ( func !== result.f1 || func !== result.f2 || func !== result.f3 ) return suite.failed();
          suite.passed();
        }
      }
    },
    formData: {
      input: {
        tests: {
          'color': suite => {
            suite.assertEquals( { x: '#66ccff' }, suite.$.formData( suite.$.html( {
              inner: { tag: 'input', type: 'color', name: 'x', value: '#66ccff' }
            } ) ) );
          },
          'date': suite => {
            suite.assertEquals( { x: '2017-11-19' }, suite.$.formData( suite.$.html( {
              inner: { tag: 'input', type: 'date', name: 'x', value: '2017-11-19' }
            } ) ) );
          },
          'datetime-local': suite => {
            suite.assertEquals( { x: '2017-11-19T09:55' }, suite.$.formData( suite.$.html( {
              inner: { tag: 'input', type: 'datetime-local', name: 'x', value: '2017-11-19T09:55' }
            } ) ) );
          },
          'email': suite => {
            suite.assertEquals( { x: 'john.doe@web.de' }, suite.$.formData( suite.$.html( {
              inner: { tag: 'input', type: 'email', name: 'x', value: 'john.doe@web.de' }
            } ) ) );
          },
          'hidden': suite => {
            suite.assertEquals( { x: 'secret' }, suite.$.formData( suite.$.html( {
              inner: { tag: 'input', type: 'hidden', name: 'x', value: 'secret' }
            } ) ) );
          },
          'month': suite => {
            suite.assertEquals( { x: '2017-11' }, suite.$.formData( suite.$.html( {
              inner: { tag: 'input', type: 'month', name: 'x', value: '2017-11' }
            } ) ) );
          },
          'password': suite => {
            suite.assertEquals( { x: 'xxx' }, suite.$.formData( suite.$.html( {
              inner: { tag: 'input', type: 'password', name: 'x', value: 'xxx' }
            } ) ) );
          },
          'search': suite => {
            suite.assertEquals( { x: 'found!' }, suite.$.formData( suite.$.html( {
              inner: { tag: 'input', type: 'search', name: 'x', value: 'found!' }
            } ) ) );
          },
          'tel': suite => {
            suite.assertEquals( { x: '0123456789' }, suite.$.formData( suite.$.html( {
              inner: { tag: 'input', type: 'tel', name: 'x', value: '0123456789' }
            } ) ) );
          },
          'text': suite => {
            suite.assertEquals( { x: 'John Doe' }, suite.$.formData( suite.$.html( {
              inner: { tag: 'input', type: 'text', name: 'x', value: 'John Doe' }
            } ) ) );
          },
          'time': suite => {
            suite.assertEquals( { x: '12:55' }, suite.$.formData( suite.$.html( {
              inner: { tag: 'input', type: 'time', name: 'x', value: '12:55' }
            } ) ) );
          },
          'url': suite => {
            suite.assertEquals( { x: 'https://www.john-doe.de' }, suite.$.formData( suite.$.html( {
              inner: { tag: 'input', type: 'url', name: 'x', value: 'https://www.john-doe.de' }
            } ) ) );
          },
          'week': suite => {
            suite.assertEquals( { x: '2017-W46' }, suite.$.formData( suite.$.html( {
              inner: { tag: 'input', type: 'week', name: 'x', value: '2017-W46' }
            } ) ) );
          }
        }
      },
      number: {
        tests: {
          'validNumber': suite => {
            suite.assertEquals( { x: 3 }, suite.$.formData( suite.$.html( {
              inner: { tag: 'input', type: 'number', name: 'x', value: 3 }
            } ) ) );
          },
          'invalidNumber': suite => {
            suite.assertEquals( { x: '' }, suite.$.formData( suite.$.html( {
              inner: { tag: 'input', type: 'number', name: 'x', value: 'foo' }
            } ) ) );
          },
          'noNumber': suite => {
            suite.assertEquals( { x: '' }, suite.$.formData( suite.$.html( {
              inner: { tag: 'input', type: 'number', name: 'x' }
            } ) ) );
          },
          'range': suite => {
            suite.assertEquals( { x: 5 }, suite.$.formData( suite.$.html( {
              inner: { tag: 'input', type: 'range', name: 'x', min: 1, max: 12, value: 5 }
            } ) ) );
          }
        }
      },
      checkbox: {
        tests: {
          'singleTrue': suite => {
            suite.assertEquals( { x: true }, suite.$.formData( suite.$.html( {
              inner: { tag: 'input', type: 'checkbox', name: 'x', checked: true }
            } ) ) );
          },
          'singleFalse': suite => {
            suite.assertEquals( { x: false }, suite.$.formData( suite.$.html( {
              inner: { tag: 'input', type: 'checkbox', name: 'x' }
            } ) ) );
          },
          'singleValueTrue': suite => {
            suite.assertEquals( { x: 'foo' }, suite.$.formData( suite.$.html( {
              inner: { tag: 'input', type: 'checkbox', name: 'x', value: 'foo', checked: true }
            } ) ) );
          },
          'singleValueFalse': suite => {
            suite.assertEquals( { x: '' }, suite.$.formData( suite.$.html( {
              inner: { tag: 'input', type: 'checkbox', name: 'x', value: 'foo' }
            } ) ) );
          },
          'multiZero': suite => {
            suite.assertEquals( { x: [ '', '' ] }, suite.$.formData( suite.$.html( {
              inner: [
                { tag: 'input', type: 'checkbox', name: 'x', value: 'foo' },
                { tag: 'input', type: 'checkbox', name: 'x', value: 'bar' }
              ]
            } ) ) );
          },
          'multiSubset': suite => {
            suite.assertEquals( { x: [ '', 'bar' ] }, suite.$.formData( suite.$.html( {
              inner: [
                { tag: 'input', type: 'checkbox', name: 'x', value: 'foo' },
                { tag: 'input', type: 'checkbox', name: 'x', value: 'bar', checked: true }
              ]
            } ) ) );
          },
          'multiMany': suite => {
            suite.assertEquals( { x: [ 'foo', 'bar' ] }, suite.$.formData( suite.$.html( {
              inner: [
                { tag: 'input', type: 'checkbox', name: 'x', value: 'foo', checked: true },
                { tag: 'input', type: 'checkbox', name: 'x', value: 'bar', checked: true }
              ]
            } ) ) );
          },
          'singleMultiMix': suite => {
            suite.assertEquals( { x: [ 'foo', 'bar', '' ], y: true, z: false }, suite.$.formData( suite.$.html( {
              inner: [
                { tag: 'input', type: 'checkbox', name: 'x', value: 'foo', checked: true },
                { tag: 'input', type: 'checkbox', name: 'x', value: 'bar', checked: true },
                { tag: 'input', type: 'checkbox', name: 'x', value: 'baz' },
                { tag: 'input', type: 'checkbox', name: 'y', checked: true },
                { tag: 'input', type: 'checkbox', name: 'z' }
              ]
            } ) ) );
          }
        }
      },
      radio: {
        tests: {
          'zero': suite => {
            suite.assertEquals( { x: '' }, suite.$.formData( suite.$.html( {
              inner: [
                { tag: 'input', type: 'radio', name: 'x', value: 'foo' },
                { tag: 'input', type: 'radio', name: 'x', value: 'bar' }
              ]
            } ) ) );
          },
          'one': suite => {
            suite.assertEquals( { x: 'bar' }, suite.$.formData( suite.$.html( {
              inner: [
                { tag: 'input', type: 'radio', name: 'x', value: 'foo' },
                { tag: 'input', type: 'radio', name: 'x', value: 'bar', checked: true }
              ]
            } ) ) );
          }
        }
      },
      select: {
        tests: {
          'singleZero': suite => {
            suite.assertEquals( { x: 'foo' }, suite.$.formData( suite.$.html( {
              inner: { tag: 'select', name: 'x', inner: [
                { tag: 'option', value: 'foo' },
                { tag: 'option', value: 'bar' }
              ] }
            } ) ) );
          },
          'singleOne': suite => {
            suite.assertEquals( { x: 'bar' }, suite.$.formData( suite.$.html( {
              inner: { tag: 'select', name: 'x', inner: [
                { tag: 'option', value: 'foo' },
                { tag: 'option', value: 'bar', selected: true }
              ] }
            } ) ) );
          },
          'singleMany': suite => {
            suite.assertEquals( { x: 'bar' }, suite.$.formData( suite.$.html( {
              inner: { tag: 'select', name: 'x', inner: [
                { tag: 'option', value: 'foo', selected: true },
                { tag: 'option', value: 'bar', selected: true }
              ] }
            } ) ) );
          },
          'selectMultiZero': suite => {
            suite.assertEquals( { x: '' }, suite.$.formData( suite.$.html( {
              inner: { tag: 'select', name: 'x', multiple: true, inner: [
                { tag: 'option', value: 'foo' },
                { tag: 'option', value: 'bar' }
              ] }
            } ) ) );
          },
          'selectMultiOne': suite => {
            suite.assertEquals( { x: 'bar' }, suite.$.formData( suite.$.html( {
              inner: { tag: 'select', name: 'x', multiple: true, inner: [
                { tag: 'option', value: 'foo' },
                { tag: 'option', value: 'bar', selected: true }
              ] }
            } ) ) );
          },
          'selectMultiMany': suite => {
            suite.assertEquals( { x: [ 'foo', 'bar' ] }, suite.$.formData( suite.$.html( {
              inner: { tag: 'select', name: 'x', multiple: true, inner: [
                { tag: 'option', value: 'foo', selected: true },
                { tag: 'option', value: 'bar', selected: true }
              ] }
            } ) ) );
          }
        }
      },
      tests: {
        'textarea': suite => {
          suite.assertEquals( { x: 'story' }, suite.$.formData( suite.$.html( {
            inner: { tag: 'textarea', name: 'x', inner: 'story' }
          } ) ) );
        },
        'objectValue': suite => {
          suite.assertEquals( { x: { foo: 'bar' } }, suite.$.formData( suite.$.html( {
            inner: { tag: 'input', type: 'text', name: 'x', value: "{'foo':'bar'}" }
          } ) ) );
        },
        'arrayValue': suite => {
          suite.assertEquals( { x: [ 'foo', 'bar' ] }, suite.$.formData( suite.$.html( {
            inner: { tag: 'input', type: 'text', name: 'x', value: "['foo','bar']" }
          } ) ) );
        },
        'dotNotation': suite => {
          suite.assertEquals( { foo: { bar: 'baz' } }, suite.$.formData( suite.$.html( {
            inner: { tag: 'input', type: 'text', name: 'foo.bar', value: 'baz' }
          } ) ) );
        },
        'xss': suite => {
          suite.assertEquals( { x: 'foo  bar' }, suite.$.formData( suite.$.html( {
            inner: { tag: 'textarea', name: 'x', inner: 'foo <script>alert("XSS");</script> bar' }
          } ) ) );
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
        suite.ccm.instance( {
          name: 'dummy',
          ccm: '../ccm.js',
          Instance: function () {}
        }, function ( instance ) {
          suite.dummy = instance;
          callback();
        } );
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
          if ( suite.ccm.helper.isFirefox() )
            suite.assertTrue( typeof document.head.children.map === 'function' );
          else
            suite.assertFalse( typeof document.head.children.map === 'function' );
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
    onFinish: {
      tests: {
        'login': suite => {
          suite.ccm.instance( 'https://akless.github.io/ccm-components/user/versions/ccm.user-2.0.0.js', user =>
            user.logout( () =>
              suite.$.onFinish( { user: user, onfinish: { login: true, callback: () =>
                suite.assertTrue( user.isLoggedIn() )
              } } )
            )
          );
        },
        'log': suite => {
          const original = console.log;
          console.log = data => {
            console.log = original;
            suite.assertSame( 'foo', data );
          };
          suite.$.onFinish( { onfinish: { log: true } }, 'foo' );
        },
        'clearTrue': suite => {
          suite.ccm.start( {
            name: 'clear1',
            ccm: '../ccm.js',
            Instance: function () {
              this.start = callback => this.ccm.helper.setContent( this.element, 'foo' ) || callback();
              this.onfinish = { clear: true };
            }
          }, instance => {
            suite.$.onFinish( instance );
            suite.assertSame( '', instance.element.innerHTML );
          } );
        },
        'clearFalse': suite => {
          suite.ccm.start( {
            name: 'clear2',
            ccm: '../ccm.js',
            Instance: function () {
              this.start = callback => this.ccm.helper.setContent( this.element, 'foo' ) || callback();
              this.onfinish = { clear: false };
            }
          }, instance => {
            suite.$.onFinish( instance );
            suite.assertSame( 'foo', instance.element.innerHTML );
          } );
        },
        'restart': suite => {
          suite.ccm.start( {
            name: 'restart',
            ccm: '../ccm.js',
            Instance: function () {
              this.ready = callback => { this.counter = 0; callback(); };
              this.start = callback => { this.ccm.helper.setContent( this.element, ++this.counter ); callback(); };
              this.onfinish = { restart: true, callback: instance => {
                suite.assertSame( '2', instance.element.innerHTML );
              } };
            }
          }, instance => suite.$.onFinish( instance ) );
        },
        'renderComponent': suite => {
          suite.$.onFinish( { onfinish: { render: {
            component: {
              name: 'render',
              ccm: '../ccm.js',
              Instance: function () {
                this.start = () => suite.assertSame( 'bar', this.foo );
              }
            },
            config: { foo: 'bar' }
          } } } );
        },
        'renderHTML': suite => {
          const elem = suite.$.html( { inner: { id: 'foo', inner: 'bar' } } );
          suite.$.onFinish( {
            root: elem.querySelector( '#foo' ),
            onfinish: {
              render: { inner: 'baz' },
              callback: () => suite.assertSame( '<div>baz</div>', elem.innerHTML )
            }
          } );
        },
        'callbackInstance': suite => {
          const instance = { onfinish: { callback: _instance => suite.assertEquals( instance, _instance ) } };
          suite.$.onFinish( instance );
        },
        'callbackResults': suite => {
          suite.$.onFinish( { onfinish: { callback: ( instance, results ) => suite.assertSame( 'foo', results ) } }, 'foo' );
        }
      },
      store: {
        setup: ( suite, callback ) => {
          suite.ccm.instance( 'https://akless.github.io/ccm-components/user/versions/ccm.user-2.0.1.js', user => {
            suite.settings = { store: 'test', key: 'test' };
            suite.ccm.store( { store: 'test', parent: { user: user } }, store => { suite.store = store; callback(); } );
          } );
        },
        tests: {
          'simple': suite => {
            suite.store.parent.onfinish = {
              store: { settings: suite.settings, key: 'test' },
              callback: () => suite.store.get( 'test', result => suite.assertEquals( { foo: 'bar', key: 'test' }, result ) )
            };
            suite.$.onFinish( suite.store.parent, { foo: 'bar' } );
          },
          'user': suite => {
            suite.store.parent.onfinish = {
              login: true,
              store: { settings: suite.settings, key: 'test', user: true },
              callback: () => suite.store.get( [ 'guest', 'test' ], result => suite.assertEquals( { foo: 'bar', key: [ 'guest', 'test' ] }, result ) )
            };
            suite.$.onFinish( suite.store.parent, { foo: 'bar' } );
          },
          'userNoInstance': suite => {
            delete suite.store.parent.user;
            suite.store.parent.onfinish = {
              login: true,
              store: { settings: suite.settings, key: 'test', user: true },
              callback: () => suite.store.get( [ 'guest', 'test' ], result =>
                result === null ? suite.store.get( 'test', result => suite.assertEquals( { foo: 'bar', key: 'test' }, result ) ) : suite.failed( 'user-specific key exists' )
              )
            };
            suite.$.onFinish( suite.store.parent, { foo: 'bar' } );
          },
          'userLoggedOut': suite => {
            suite.store.parent.onfinish = {
              store: { settings: suite.settings, key: 'test', user: true },
              callback: () => suite.store.get( [ 'guest', 'test' ], result =>
                result === null ? suite.store.get( 'test', result => suite.assertEquals( { foo: 'bar', key: 'test' }, result ) ) : suite.failed( 'user-specific key exists' )
              )
            };
            suite.$.onFinish( suite.store.parent, { foo: 'bar' } );
          },
          'permissions': suite => {
            suite.store.parent.onfinish = {
              store: { settings: suite.settings, key: 'test', permissions: 'baz' },
              callback: () => suite.store.get( 'test', result => suite.assertEquals( { foo: 'bar', key: 'test', '_': 'baz' }, result ) )
            };
            suite.$.onFinish( suite.store.parent, { foo: 'bar' } );
          }
        },
        finally: ( suite, callback ) => suite.store.del( 'test', () => suite.store.del( [ 'guest', 'test' ], callback ) )
      }
    },
    privatize: {
      tests: {
        'someProperties': function ( suite ) {
          suite.ccm.instance( {
            name: 'dummy1',
            ccm: 'https://akless.github.io/ccm/ccm.js',
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
          }, function ( instance ) {
            if ( instance.foo !== 'abc' ) suite.failed( 'no public property "foo" with value "abc"' );
            suite.assertEquals( [ 'foo', 'ccm', 'id', 'index', 'component', 'root', 'element', 'dependency' ], Object.keys( instance ) );
          } );
        },
        'allProperties': function ( suite ) {
          suite.ccm.instance( {
            name: 'dummy2',
            ccm: 'https://akless.github.io/ccm/ccm.js',
            config: { foo: 'abc', bar: 'xyz' },
            Instance: function () {
              var self = this;
              var my;
              this.ready = function ( callback ) {
                my = suite.ccm.helper.privatize( self );
                callback();
              };
            }
          }, { baz: [ 'ccm.instance', 'dummy2' ] }, function ( instance ) {
            suite.assertEquals( [ 'ccm', 'baz', 'id', 'index', 'component', 'root', 'element' ], Object.keys( instance ) );
          } );
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
        suite.url = 'https://akless.github.io/ccm/unit_tests/dummy/style.css';
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
    solveDotNotation: {
      tests: {
        'simple': suite => {
          suite.assertEquals( { foo: 'bar', n: 5711, is: true }, suite.$.solveDotNotation( { foo: 'bar', n: 5711, is: true } ) );
        },
        'object': suite => {
          suite.assertEquals( { foo: { bar: 'baz', n: 5711, is: true } }, suite.$.solveDotNotation( { 'foo.bar': 'baz', 'foo.n': 5711, 'foo.is': true } ) );
        },
        'array': suite => {
          suite.assertEquals( { foo: [ 'bar', 'baz' ] }, suite.$.solveDotNotation( { 'foo.0': 'bar', 'foo.1': 'baz' } ) );
        },
        'complex': suite => {
          suite.assertEquals( { foo: { bar: [ { baz: [ 'A', 'B' ] } ] } }, suite.$.solveDotNotation( { 'foo.bar.0.baz.0': 'A', 'foo.bar.0.baz.1': 'B' } ) );
        }
      }
    },
    toDotNotation: {
      tests: {
        'simple': suite => {
          suite.assertEquals( { foo: 'bar', n: 5711, is: true }, suite.$.toDotNotation( { foo: 'bar', n: 5711, is: true } ) );
        },
        'object': suite => {
          suite.assertEquals( { 'foo.bar': 'baz', 'foo.n': 5711, 'foo.is': true }, suite.$.toDotNotation( { foo: { bar: 'baz', n: 5711, is: true } } ) );
        },
        'array': suite => {
          suite.assertEquals( { 'foo.0': 'bar', 'foo.1': 'baz' }, suite.$.toDotNotation( { foo: [ 'bar', 'baz' ] } ) );
        },
        'complex': suite => {
          suite.assertEquals( { 'foo.bar.0.baz.0': 'A', 'foo.bar.0.baz.1': 'B' }, suite.$.toDotNotation( { foo: { bar: [ { baz: [ 'A', 'B' ] } ] } } ) );
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
            many: suite.ccm.helper.isFirefox() ? [ {} ] : { 0: {} }
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
            node: document.createElement( 'span' ),
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
  finally: ( suite, callback ) => {
    [ ...document.querySelectorAll( 'link'       ) ].map( suite.$.removeElement );
    [ ...document.querySelectorAll( 'script'     ) ].map( suite.$.removeElement );
    [ ...document.querySelectorAll( 'body > div' ) ].map( suite.$.removeElement );
    callback();
  }
};