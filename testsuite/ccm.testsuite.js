/**
 * @overview <i>ccm</i> component for running tests
 * @author André Kless <andre.kless@web.de> 2016
 * @license The MIT License (MIT)
 */

ccm.component( {
  name: 'testsuite',
  config: {
    style: [ ccm.load, '../testsuite/default.css' ]
  },
  Instance: function () {

    var self = this;
    var tests;
    var setup;
    var onFinish;
    var table;
    var row;
    var loading;
    var i;
    var passed;
    var failed;

    this.init = function ( callback ) {

      // support using tests from own global namespace
      if ( typeof self.data === 'string' ) {
        var package = self.data;
        var key = package.split( '.' ).shift();
        self.data = ccm.components.testsuite[ key ];
        self.data.key = key;
        self.data.package = package;
      }

      callback();
    };

    this.render = function ( callback ) {

      // prepare own website area
      ccm.helper.element( self );

      // get dataset for rendering (dataset contains the tests)
      ccm.helper.dataset( self.data, function ( dataset ) {

        var setups = [];
        if ( dataset.setup ) setups.push( dataset.setup );

        // clear own website area
        self.element.innerHTML = '';

        var package = getPackage();

        function getPackage() {
          if ( !dataset.package ) return dataset;
          var path = dataset.package.split( '.' ); path.shift();
          var package = dataset;
          while ( path.length > 0 ) {
            package = package[ path.shift() ];
            if ( package.setup ) setups.push( package.setup );
          }
          return package;
        }

        // more then one test package? => handle it
        if ( !package.tests ) return handleIt();

        // prepare tests
        tests = package.tests;
        setup = runSetups;
        i = passed = failed = 0;
        toArray();
        onFinish = callback;

        // prepare table
        self.element.appendChild( ccm.helper.html( { class: 'label', inner: document.createTextNode( ( dataset.package || dataset.key ).split( '.' ).join( ' > ' ) ) } ) );
        table = ccm.helper.html( { class: 'table' } );
        self.element.appendChild( table );

        // start running first test
        runNextTest();

        function handleIt() {

          var packages = [];
          find( package, ( dataset.package || dataset.key ).split( '.' ) );
          self.element.classList.add( 'packages' );
          run();

          function find( obj, package ) {
            if ( obj.tests ) return packages.push( package.join( '.' ) );
            for ( var key in obj )
              if ( ccm.helper.isObject( obj[ key ] ) ) {
                var copy = package.slice();
                copy.push( key );
                find( obj[ key ], copy );
              }
          }

          function run() {
            if ( packages.length === 0 ) { if ( callback ) callback(); return; }
            var div = ccm.helper.html( { id: ccm.helper.getElementID( self ) + '-' + packages.length } );
            self.element.appendChild( div );
            dataset.package = packages.shift();
            self.component.render( { parent: self, element: div, data: dataset }, run );
          }
        }

        function runSetups( suite, callback ) {
          var i = 0;
          runSetup();
          function runSetup() {
            if ( i === setups.length ) return callback();
            setups[ i++ ]( suite, runSetup );
          }
        }

        function toArray() {
          // if tests are given via object, than convert object to array
          if ( !ccm.helper.isObject( tests ) ) return;
          tests = Object.keys( tests ).map( function ( key ) {
            // if test function has no name, than use property key of the test inside the object as name
            if ( !tests[ key ].name )
              Object.defineProperty( tests[ key ], 'name', { value: key } );
            return tests[ key ];
          } );
        }

      } );

    };

    function runNextTest() {

      if ( i === tests.length ) return finish();
      if ( setup ) setup( self, proceed ); else proceed();

      function proceed() {
        loading = ccm.helper.loading();
        row = ccm.helper.html( { inner: [ { inner: [ tests[ i ].name, loading ] } ] } );
        table.appendChild( row );
        tests[ i ]( self );
      }
    }

    this.passed = function () {
      addResult( true );
      finishTest();
    };

    this.failed = function () {
      addResult( false );
      finishTest();
    };

    this.assertTrue = function ( condition ) {
      addResult( condition );
      finishTest();
    };

    this.assertFalse = function ( condition ) {
      addResult( !condition );
      finishTest();
    };

    this.assertEquals = function ( expected, actual ) {
      var result = expected === actual;
      addResult( result );
      if ( !result )
        row.appendChild( ccm.helper.html( { class: 'assert_equals', inner: [ { inner: expected }, { inner: actual ? actual : { tag: 'i', inner: JSON.stringify( actual ) } } ] } ) );
      finishTest();
    };

    this.assertSame = function ( expected, actual ) {
      this.assertEquals( JSON.stringify( expected ), JSON.stringify( actual ) );
    };

    function addResult( result ) {
      var value = result ? 'passed' : 'failed';
      if ( result ) passed++; else failed++;
      row.firstChild.removeChild( loading );
      row.appendChild( ccm.helper.html( { class: value, inner: value } ) );
    }

    function finishTest() {
      i++;
      runNextTest();
    }

    function finish() {
      self.element.appendChild( ccm.helper.html( { class: 'results', inner: [ { inner: i }, { inner: passed }, { inner: failed } ] } ) );
      if ( onFinish ) onFinish();
    }

  }

} );