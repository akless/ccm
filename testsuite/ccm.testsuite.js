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

    var tests;      // setup function that is performed before the current executing test
    var onFinish;   // callback when all tests are performed and results are completely rendered
    var table;      // HTML DOM Element of the table from the current executing test
    var row;        // HTML DOM Element of the table row from the current executing test
    var loading;    // HTML DOM Element of the loading icon from the current executing test
    var i;          // number of executed tests
    var passed;     // number of passed tests
    var failed;     // number of failed tests

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

        /**
         * collected setup functions that have to be performed before each test
         * @type {function[]}
         */
        var setups = [];

        // setup function on highest package level? => add it
        if ( dataset.setup ) setups.push( dataset.setup );

        // clear own website area
        self.element.innerHTML = '';

        // navigate to the relevant test package
        var package = getPackage();

        // more test packages inside the relevant test package? => abort and run tests of each inner test package
        if ( !package.tests ) return runEachPackage();

        // prepare tests of the test package for running
        tests = package.tests;
        setup = runSetups;        // set setup function
        i = passed = failed = 0;  // reset test counters
        toArray();                // unsure that test package is an array
        onFinish = callback;      // remember finish callback

        // prepare table
        self.element.appendChild( ccm.helper.html( { class: 'label', inner: document.createTextNode( ( dataset.package || dataset.key ) ) } ) );
        table = ccm.helper.html( { class: 'table' } );
        self.element.appendChild( table );

        // run all tests of the test package
        runNextTest();

        function getPackage() {

          // no package path? => dataset itself is relevant test package
          if ( !dataset.package ) return dataset;

          // navigate to relevant test package
          var path = dataset.package.split( '.' ); path.shift();
          var package = dataset;
          while ( path.length > 0 ) {
            package = package[ path.shift() ];
            // collect founded setup functions
            if ( package.setup ) setups.push( package.setup );
          }
          return package;
        }

        /**
         * Founds all inner test packages and renders a new ccm test suite instance for each
         * founded test package inside an separate inner own website area.
         */
        function runEachPackage() {

          /**
           * founded paths to inner test packages
           * @type {string[]}
           */
          var packages = [];

          // find all paths to inner test packages
          find( package, ( dataset.package || dataset.key ).split( '.' ) );

          // tell layout that many packages will displayed
          self.element.classList.add( 'packages' );

          // run tests of each founded test package
          runNextPackage();

          /**
           * @param obj - current test package level
           * @param package - current test package path
           */
          function find( obj, package ) {
            if ( obj.tests ) return packages.push( package.join( '.' ) );
            for ( var key in obj )
              if ( ccm.helper.isObject( obj[ key ] ) ) {
                var copy = package.slice();
                copy.push( key );
                find( obj[ key ], copy );  // recursive call
              }
          }

          /**
           * renders new ccm test suite instance for each founded test package
           */
          function runNextPackage() {
            if ( packages.length === 0 ) { if ( callback ) callback(); return; }                            // Remember: Running of each test package could be asynchron
            var div = ccm.helper.html( { id: ccm.helper.getElementID( self ) + '-' + packages.length } );   //           and must be performed sequentially
            self.element.appendChild( div );                                                                //           to avoid mutual influence.
            dataset.package = packages.shift();
            self.component.render( { parent: self, element: div, data: dataset }, runNextPackage );  // recursive call
          }

        }

        /**
         * this setup function performs all collected setup functions
         */
        function runSetups( suite, callback ) {
          var i = 0;                                              // Remember: Each setup function could be asynchron
          runSetup();                                             //           and must performed sequentially
          function runSetup() {                                   //           to avoid mutual influence.
            if ( i === setups.length )
              return callback();
            setups[ i++ ]( suite, runSetup );  // recursive call
          }
        }

        /**
         * convert test package to array and ensure that each test has a function name
         */
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

    /**
     * finishes current test with a negative result
     * @param {string} [message] - message that explains why the test has failed
     */
    this.failed = function ( message ) {
      addResult( false );
      row.appendChild( ccm.helper.html( { class: 'message', inner: message } ) );
      finishTest();
    };

    /**
     * finishes current test with positive result if the given condition is true
     * @param {boolean} condition
     */
    this.assertTrue = function ( condition ) {
      addResult( condition );
      finishTest();
    };

    /**
     * finishes current test with negative result if the given condition is true
     * @param {boolean} condition
     */
    this.assertFalse = function ( condition ) {
      addResult( !condition );
      finishTest();
    };

    /**
     * finishes current test with positive result if given expected and actual value contains same data
     * @param {object} expected
     * @param {object} actual
     */
    this.assertSame = function ( expected, actual ) {
      var result = expected === actual;
      addResult( result );
      if ( !result )
        row.appendChild( ccm.helper.html( { class: 'expected', inner: [ { inner: expected }, { inner: actual ? actual : { tag: 'i', inner: actual === undefined ? 'undefined' : JSON.stringify( actual ) } } ] } ) );
      finishTest();
    };

    /**
     * finishes current test with positive result if given expected value equals given actual value
     * @param {object} expected
     * @param {object} actual
     */
    this.assertEquals = function ( expected, actual ) {
      this.assertSame( JSON.stringify( expected ), JSON.stringify( actual ) );
    };

    /**
     * finishes current test with positive result if given expected and actual value NOT contains same data
     * @param {object} expected
     * @param {object} actual
     */
    this.assertNotSame = function ( expected, actual ) {
      var result = expected !== actual;
      addResult( result );
      finishTest();
    };

    /**
     * finishes current test with positive result if given expected value NOT equals given actual value
     * @param {object} expected
     * @param {object} actual
     */
    this.assertNotEquals = function ( expected, actual ) {
      this.assertNotSame( JSON.stringify( expected ), JSON.stringify( actual ) );
    };

    /**
     * runs next test of the test package
     */
    function runNextTest() {

      if ( i === tests.length ) return finish();
      if ( setup ) setup( self, proceed ); else proceed();  // perform setup function before each test (could be asynchron)

      // tests will executed sequentially to avoid mutual influence, this is done recursively because running of every test could be asynchron
      function proceed() {
        loading = ccm.helper.loading();  // show loading icon while current test is running
        row = ccm.helper.html( { inner: [ { inner: [ tests[ i ].name, loading ] } ] } );
        table.appendChild( row );
        tests[ i ]( self );       // run next test (could be asynchron)

        // each test calls finally a method like assertTrue() or passed() that calls this function again -> recursive
      }
    }

    /**
     * removes loading icon and shows test results and increase the relevant test counters
     */
    function addResult( result ) {
      var value = result ? 'passed' : 'failed';
      if ( result ) passed++; else failed++;
      row.firstChild.removeChild( loading );
      row.appendChild( ccm.helper.html( { class: value, inner: value } ) );
    }

    /**
     * increases test counter and start running next test
     */
    function finishTest() {
      i++;
      runNextTest();  // recursive call
    }

    /**
     * renders test counter values and perform finish callback
     */
    function finish() {
      self.element.appendChild( ccm.helper.html( { class: 'results', inner: [ { inner: i }, { inner: passed }, { inner: failed } ] } ) );
      if ( onFinish ) onFinish();
    }

  }

} );