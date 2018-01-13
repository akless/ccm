/**
 * @overview Clientseitiges Komponentenmodell (ccm)
 *
 * @version 1.0.0
 * @author André Kless <andre.kless@web.de>
 * @copyright André Kless 2014-2015
 */

// Kein jQuery vorhanden? => Aktuellste Version nachladen
if ( !window.jQuery ) document.write( '<script src="http://code.jquery.com/jquery-latest.min.js"></script>' );

/**
 * Clientseitiges Komponentenmodell (ccm)
 * @namespace
 */
var ccm = function () {

  /*---------------------------- Private Members -----------------------------*/

  /**
   * @summary Standard-URL zu den Ressourcen
   * @private
   * @type {string}
   */
  var url = 'http://www.fh-lsoopjava.de/ccm/components/';

  /**
   * @summary ccm-Datenbank der IndexedDB
   * @private
   * @type {object}
   */
  var db;

  /**
   * @summary Erzeugung von Datenspeichern
   * @memberOf ccm
   * @private
   * @constructor
   */
  var Datastore = function () {


    /*------------------------------- Members --------------------------------*/

    /**
     * @summary Eigener Kontext
     * @private
     * @this ccm.Datastore
     * @type {ccm.Datastore}
     */
    var self = this;


    /*------------------------------- Methods --------------------------------*/

    /**
     * @summary Liefert Datensatz
     * @this ccm.Datastore
     * @param {ccm.Key} key - Key des Datensatzes
     * @param {function} [callback] - Callback (bekommt ermittelten Datensatz als ersten Parameter übergeben)
     * @returns {ccm.Dataset} Ermittelter Datensatz
     */
    this.get = function ( key, callback ) {

      // Datenquelle abfragen
      if ( self.store ) return clientDB();                 // Clientseitige Datenbank
      if ( self.url   ) return serverDB();                 // Serverseitige Datenbank
      if ( self.local ) return getLocal( key, callback );  // Lokaler Datenspeicher

      /**
       * Liefert Datensatz aus clientseitiger Datenbank
       */
      function clientDB() {

        /**
         * Lokaler Datensatz
         * @type {ccm.Dataset}
         */
        var dataset = checkLocal();

        // Lokaler Datensatz? => Zurückgeben
        if ( dataset ) return dataset;

        /**
         * Objektspeicher
         * @type {object}
         */
        var store = getStore();

        // Datensatz ermitteln
        var request = store.get( key );

        // Wenn Datensatz ermittelt
        request.onsuccess = function ( evt ) {

          /**
           * Ermittelter Datensatz
           * @type {ccm.Dataset}
           */
          var dataset = evt.target.result;

          // Datensatz im lokalen Datenspeicher speichern
          if ( dataset.key !== undefined ) self.local[ key ] = dataset;

          // Callback mit Datensatz aufrufen
          if ( callback ) callback( dataset );
        };
      }

      /**
       * Liefert Datensatz aus serverseitiger Datenbank
       */
      function serverDB() {

        /**
         * Lokaler Datensatz
         * @type {ccm.Dataset}
         */
        var dataset = checkLocal();

        // Lokalen Datensatz? => Zurückgeben
        if ( dataset ) return dataset;

        // Datensatz über Serverschnittstelle laden
        ccm.load( self.url, { key: key }, function ( dataset ) {

          // Datensatz im lokalen Datenspeicher speichern
          if ( dataset.key !== undefined ) self.local[ key ] = dataset;

          // Callback mit Datensatz aufrufen
          callback( dataset );

        } );
      }

      /**
       * Prüft ob Datensatz bereits lokal vorhanden ist
       * @returns {ccm.Dataset}
       */
      function checkLocal() {

        /**
         * Ermittelter Datensatz
         * @type {ccm.Dataset}
         */
        var dataset = getLocal( key );

        // Lokaler Datensatz?
        if ( dataset ) {

          // Callback mit Datensatz aufrufen
          if ( callback ) callback( dataset );
        }

        // Datensatz zurückgeben
        return dataset;
      }

    };

    /**
     * @summary Erstellt oder ändert Datensatz
     * @this ccm.Datastore
     * @param {ccm.Dataset} priodata - Prioritätsdaten
     * @param {function} [callback] - Callback (bekommt geänderten Datensatz als ersten Parameter übergeben)
     * @returns {ccm.Dataset} Geänderter Datensatz
     */
    this.set = function ( priodata, callback ) {

      // Datenquelle abfragen
      if ( self.store ) return clientDB();  // Clientseitige Datenbank
      if ( self.url   ) return serverDB();  // Serverseitige Datenbank
      if ( self.local ) return setLocal();  // Lokaler Datenspeicher

      /**
       * Setzt Datensatz in lokalem Datenspeicher
       * @returns {ccm.Dataset} Geänderter Datensatz
       */
      function setLocal() {

        // Datensatz existiert? => Aktualisieren
        if ( self.local[ priodata.key ] )
          ccm.helper.integrate( priodata, self.local[ priodata.key ] );

        // Kein Datensatz => Neu anlegen
        else
          self.local[ priodata.key ] = priodata;

        // Datensatz zurückgeben
        return getLocal( priodata.key, callback );
      }

      /**
       * Setzt Datensatz in clientseitiger Datenbank
       * @returns {ccm.Dataset} Geänderter Datensatz
       */
      function clientDB() {

        /**
         * Objektspeicher
         * @type {object}
         */
        var store = getStore();

        // Datensatz erstellen/ändern
        var request = store.put( priodata );

        // Wenn Datensatz erstellt/geändert
        request.onsuccess = function () {

          // Lokalen Datensatz erstellen/ändern
          setLocal();
        };
      }

      /**
       * Setzt Datensatz in serverseitiger Datenbank
       * @returns {ccm.Dataset} Geänderter Datensatz
       */
      function serverDB() {

        // Datensatz an Serverschnittstelle senden
        ccm.load( self.url, { dataset: priodata }, function ( dataset ) {

          // Als Antwort erhaltenen Datensatz im lokalen Datenspeicher speichern
          if ( dataset.key !== undefined ) setLocal();

        } );
      }

    };

    /**
     * @summary Löscht Datensatz
     * @this ccm.Datastore
     * @param {ccm.Key} key - Key des Datensatzes
     * @param {function} [callback] - Callback (bekommt gelöschten Datensatz als ersten Parameter übergeben)
     * @returns {ccm.Dataset} Gelöschter Datensatz
     */
    this.del = function ( key, callback ) {

      // Datenquelle abfragen
      if ( self.store ) return clientDB();  // Clientseitige Datenbank
      if ( self.url   ) return serverDB();  // Serverseitige Datenbank
      if ( self.local ) return delLocal();  // Lokaler Datenspeicher

      /**
       * Löscht Datensatz in lokalem Datenspeicher
       * @returns {ccm.Dataset} Gelöschter Datensatz
       */
      function delLocal() {

        /**
         * Zu löschender Datensatz
         * @type {ccm.Dataset}
         */
        var dataset = self.local[ key ];

        // Datensatz löschen
        delete self.local[ key ];

        // Callback mit gelöschten Datensatz aufrufen
        if ( callback ) callback( dataset );

        // Gelöschten Datensatz zurückgeben
        return dataset;
      }

      /**
       * Löscht Datensatz in clientseitiger Datenbank
       */
      function clientDB() {

        /**
         * Objektspeicher
         * @type {object}
         */
        var store = getStore();

        // Datensatz löschen
        var request = store.delete( key );

        // Wenn Datensatz gelöscht
        request.onsuccess = function () {

          // Lokalen Datensatz löschen
          delLocal();
        };
      }

      /**
       * Löscht Datensatz in serverseitiger Datenbank
       */
      function serverDB() {

        // Key an Serverschnittstelle senden
        ccm.load( self.url, { del: key }, function ( dataset ) {

          // Datensatz im lokalen Datenspeicher löschen
          if ( dataset.key !== undefined ) delLocal();

        } );
      }

    };

    /**
     * Liefert Datensatz aus lokalem Datenspeicher
     * @param {ccm.Key} key - Key des Datensatzes
     * @param {function} [callback] - Callback (bekommt ermittelten Datensatz als ersten Parameter übergeben)
     * @returns {ccm.Dataset} Ermittelter Datensatz
     */
    function getLocal( key, callback ) {

      /**
       * Ermittelter Datensatz
       * @type {ccm.Dataset}
       */
      var dataset = ccm.helper.clone( self.local[ key ] );

      // Callback mit Datensatz aufrufen
      if ( callback ) callback( dataset );

      // Datensatz zurückgeben
      return dataset;
    }

    /**
     * Liefert Objektspeicher
     * @returns {object}
     */
    function getStore() {

      /**
       * Transaktion
       * @type {object}
       */
      var trans = db.transaction( [ self.store ], 'readwrite' );

      // Objektspeicher ermitteln und zurückgeben
      return trans.objectStore( self.store );
    }

  };

  return {

    /*---------------------------- Public Members ----------------------------*/

    /**
     * @summary Geladene Komponenten
     * @memberOf ccm
     * @namespace
     * @type {Object.<ccm.Index, ccm.Component>}
     * @readonly
     */
    components: {},

    /**
     * @summary Erstellte Datenspeicher
     * @memberOf ccm
     * @namespace
     * @type {ccm.Datastore[]}
     * @readonly
     */
    datastores: [],

    /**
     * @ignore
     */
    callback: {},

    /*---------------------------- Public Methods ----------------------------*/

    /**
     * @summary Nachladen von Ressourcen (JavaScript-, CSS- und JSON-Dateien) und/oder Datenaustausch mit Serverschnittstellen
     * @memberOf ccm
     * @param {string|string[]} resources - Ressourcen und/oder Serverschnittstellen
     * @param {object|function} [data] - Daten die an Serverschnittstellen gesendet werden (kann ausgelassen werden)
     * @param {function} [callback] - Wenn laden von Ressourcen und/oder Datenaustausch mit Serverschnittstellen erfolgreich abgeschlossen (bekommt Ergebnisse als ersten Parameter übergeben)
     * @example
     * // Laden der ccm-Komponente mit dem Index 'counter'
     * ccm.load( 'counter', callback );
     * @example
     * // Laden einer JavaScript-Datei (ist auch ccm-Komponente)
     * ccm.load( 'components/runningtext.js', callback );
     * @example
     * // Laden einer CSS-Datei
     * ccm.load( 'css/dialogbox.css' );
     * @example
     * // Laden einer Bild-Datei
     * ccm.load( 'img/example.png' );
     * @example
     * // Laden einer JSON-Datei
     * ccm.load( 'data/test1.json', callback );
     * // Antwort des Servers: {"message":"Hello, world!"}
     * @example
     * // Laden einer JavaScript-Datei (cross-domain)
     * ccm.load( 'http://code.jquery.com/jquery-latest.min.js', callback );
     * @example
     * // Laden einer ccm-Komponente (cross-domain)
     * ccm.load( 'http://www.fh-lsoopjava.de/ccm/components/lang.js', callback );
     * @example
     * // Laden einer CSS-Datei (cross-domain)
     * ccm.load( 'http://www.fh-lsoopjava.de/ccm/css/codebox.css' );
     * @example
     * // Laden einer Bild-Datei (cross-domain)
     * ccm.load( 'http://www.fh-lsoopjava.de/ccm/img/dialogbox.png' );
     * @example
     * // Laden der Daten einer JSON-Datei (cross-domain)
     * ccm.load( 'http://www.fh-lsoopjava.de/ccm/data/test1.json', callback );
     * // Inhalt der JSON-Datei: ccmCallback({"message":"Hello, world!"})
     * // Ergebnis vom Datenaustausch: {"message":"Hello, world!"}
     * @example
     * // Datenaustausch mit Serverschnittstelle (cross-domain)
     * ccm.load( 'http://www.fh-lsoopjava.de/ccm/data/greetings.php', {name: 'world'}, callback );
     * // Antwort des Servers: 'Hello world!'
     */
    load: function ( resources, data, callback ) {

      // Nur eine Ressource? => Als Array verpacken
      if ( typeof( resources ) === 'string' ) resources = [ resources ];

      // Daten ausgelassen? => Daten sind Callback
      if ( typeof ( data ) === 'function' ) { callback = data; data = undefined; }

      /**
       * Angeforderte Ressourcen
       * @type {number}
       */
      var counter = 0;

      /**
       * Ergebnisse
       * @type {object|object[]}
       */
      var results = new Array( resources.length );

      // Ressourcen durchgehen => Ressource laden
      for ( var i = 0; i < resources.length; i++ ) loadResource( resources[ i ], i );

      /**
       * Nachladen einer Ressource
       * @param {string} resource - Ressource
       * @param {number} i - Feldindex
       */
      function loadResource( resource, i ) {

        /**
         * Pfad zur Ressource
         * @type {string}
         */
        var path = resource.indexOf( '/' ) === -1 ? url + resource + '.js' : resource;

        /**
         * Dateiendung der Ressource
         * @type {string}
         */
        var suffix = path.split( '.' ).pop();

        // Pfad als Ergebnis vermerken
        results[ i ] = path;

        // CSS-Datei? => Nachladen (ohne Callback)
        if ( suffix === 'css' ) return loadCSS( path );

        // Bild-Datei? => Nachladen (ohne Callback)
        switch ( suffix ) {
          case 'png':
          case 'jpg':
          case 'gif':
            return loadImage( path );
        }

        // Hochzählen
        counter++;

        // JavaScript-Datei? => Nachladen
        if ( suffix === 'js' ) return loadJS( path, successJS );

        // JSON-Datei und cross-domain?
        if ( suffix === 'json' && path.indexOf( 'http' ) === 0 ) return loadJSON( path, successData );

        // Datenaustausch mit Server starten
        exchangeData( path, data, successData );

        /**
         * Laden einer CSS-Datei
         * @param {string} url - URL
         */
        function loadCSS( url ) {

          jQuery( 'head' ).append( '<link rel="stylesheet" type="text/css" href="' + url + '">' );
        }

        /**
         * Laden einer Bild-Datei
         * @param {string} url - URL
         */
        function loadImage( url ) {

          jQuery( '<img src="' + url + '">' );
        }

        /**
         * Nachladen einer JavaScript-Datei
         * @param {string} url - URL
         * @param {function} callback - Callback
         */
        function loadJS( url, callback ) {

          jQuery.getScript( url, callback ).fail( onFail );

          /*
          jQuery.ajax( {

            url: url,
            dataType: 'script',
            mimeType: 'application/javascript', // bei jQuery.getScript() wird falscher MIME-Type verwendet
            success: callback

          } ).fail( onFail );
          */
        }

        /**
         * Nachladen einer JSON-Datei (cross-domain)
         * @param {string} url - URL
         * @param {function} callback - Callback
         */
        function loadJSON( url, callback ) {

          // JSON-Datei anfordern
          jQuery( 'head' ).append( '<script src="'+url+'"></script>' );

          /**
           * Name der JSON-Datei
           * @type {string}
           */
          var filename = url.split( '/' ).pop();

          // Callback zwischenspeichern
          ccm.callback[ filename ] = callback;
        }

        /**
         * Datenaustausch mit Server
         * @param {string} url - URL
         * @param {object} [data] - Daten die an Server gesendet werden
         * @param {function} [callback] - Callback
         */
        function exchangeData( url, data, callback ) {

          // Andere Domäne? => JSONP verwenden
          if ( url.indexOf( 'http' ) === 0 ) {

            jQuery.ajax( {

              url: url,
              data: data,
              dataType: "jsonp",
              //mimeType: 'application/javascript', // bei jQuery.getJSON() wird falscher MIME-Type verwendet
              success: callback

            } );
          }
          // Eigene Domäne => Normaler HTTP-Request
          else
            jQuery.getJSON( url, data, callback ).fail( onFail );
        }

        /**
         * Wenn JavaScript-Datei erfolgreich geladen
         */
        function successJS() {

          /**
           * Index der eventuell geladene Komponente
           * @type {ccm.Index}
           */
          var index = filterIndex( path );

          /**
           * Eventuell geladene Komponente
           * @type {ccm.Component}
           */
          var component = ccm.components[ index ];

          // Keine Komponente? => Zurücksetzen und Abbrechen mit Callback
          if ( !component ) { delete ccm.components[ index ]; return success(); }

          // Referenz auf Komponente als Ergebnis vermerken
          results[ i ] = ccm.components[ index ];

          // Array für erstellte Instanzen anlegen (@readonly)
          component.instances = [];

          // Index der Komponenten hinzufügen
          component.index = index;

          // Funktion zum Erstellen einer Instanz hinzufügen
          component.create = function ( config, callback ) { return ccm.create( index, config, callback ); };

          // Vorbelegung der Standardkonfiguration festlegen
          if ( !component.config )           component.config           = {};
          if ( !component.config.element )   component.config.element   = jQuery( 'body' );
          if ( !component.config.autostart ) component.config.autostart = true;

          // Komponente initialisieren
          if ( component.init ) component.init();

          // Ressource erfolgreich geladen
          success();

        }

        /**
         * Wenn Datenaustausch mit Server erfolgreich
         * @param {*} data - Vom Server erhaltene Daten
         */
        function successData( data ) {

          // Daten erhalten? => Als Ergebnis vermerken
          if ( data !== undefined ) results[ i ] = data;

          // Datenaustausch erfolgreich
          success();
        }

        /**
         * Wenn Laden von Ressource oder Datenaustausch erfolgreich
         */
        function success() {

          // Runterzählen
          counter--;

          // Alles erfolgreich abgeschlossen?
          if ( counter === 0 ) {

            // Nur ein Ergebnis? => Kein Array verwenden
            if ( results.length === 1 ) results = results[ 0 ];

            // Callback mit Ergebnissen aufrufen
            if ( callback ) callback( results );
          }
        }

        /**
         * @summary Wenn Serveranfrage fehlschlägt
         * @param {ccm.JqXHR} jqxhr
         * @param {string} textStatus
         * @param {string} error
         */
        function onFail( jqxhr, textStatus, error ) {

          // Fehlerbericht anzeigen
          jQuery( 'body' ).html( jqxhr.responseText + '<p>Request Failed: ' + textStatus + ', ' + error + '</p>' );
        }

      }

    },

    /**
     * @summary Erstellt Instanz einer Komponente oder einen Datenspeicher
     * @memberOf ccm
     * @param {ccm.Index|string|ccm.DataSettings} [component] - Index der Komponente, Pfad zu dessen JavaScript-Datei oder Einstellungen für Datenspeicher (Default: Leerer lokaler Datenspeicher)
     * @param {ccm.Config|function} [config={}] - Konfiguration für Komponente (siehe Dokumentation der Komponente, kann ausgelassen werden)
     * @param {function} [callback] - Wenn Instanz oder Datenspeicher erstellt (bekommt Ergebnis als ersten Parameter übergeben)
     * @returns {ccm.Instance|ccm.Datastore} Achtung! Nur wenn ALLE benötigten Ressourcen und Daten bereits geladen sind (sonst asynchron)
     */
    create: function ( component, config, callback ) {

      // Konfiguration ausgelassen? => Konfiguration ist Callback
      if ( typeof ( config ) === 'function' ) { callback = config; config = undefined; }

      // Entweder Instanz oder Datenspeicher erstellen
      return typeof ( component ) === 'string' ? createInstance( component, config ) : createDatastore( component );

      /**
       * Erstellt eine Instanz einer Komponente
       * @param {ccm.Index|string} component - Index der Komponente oder Pfad zu dessen JavaScript-Datei
       * @param {ccm.Config} [config={}] - Konfiguration für Komponente (siehe Dokumentation der Komponente, kann ausgelassen werden)
       * @returns {ccm.Instance} Instanz (nur wenn synchron)
       */
      function createInstance( component, config ) {

        /**
         * @summary Angeforderte Ressourcen
         * @type {number}
         */
        var counter = 0;

        /**
         * Ergebnis-Instanz
         * @type {ccm.Instance}
         */
        var result;

        /**
         * Warteliste für noch zu erstellende Instanzen
         * @type {ccm.Action[]}
         */
        var waiter = [];

        // Rekuriver Einstieg zum Auflösen aller Abhängigkeiten
        return recursive( component, config );

        /**
         * Rekursion zum Auflösen aller Abhängigkeiten
         * @param {ccm.Index|string} component - Index der Komponente oder Pfad zu dessen JavaScript-Datei
         * @param {ccm.Config} [config={}] - Konfiguration (aktuelle Rekursionsstufe)
         * @param {ccm.Config} [upper_config] - Konfiguration (vorherige Rekursionsstufe)
         * @param {string} [upper_key] - Key in upper_config unter dem erstellte Instanz abzulegen ist
         * @returns {ccm.Instance} Instanz (nur wenn synchron)
         */
        function recursive( component, config, upper_config, upper_key ) {

          /**
           * Index der Komponente
           * @type {ccm.Index}
           */
          var index = filterIndex( component );

          // Wird Komponente bereits geladen? => Auf Warteliste setzen und Abbrechen
          if ( ccm.components[ index ] === null ) { waiter.push( [ recursive, component, config, upper_config, upper_key ] ); return null; }

          // Hochzählen
          counter++;

          // Komponente nachladen, falls notwendig
          return !ccm.components[ index ] ? ccm.load( component, proceed ) : proceed();

          /**
           * Fortfahren mit Erstellung der Instanz
           * @returns {ccm.Instance} Instanz (nur wenn synchron)
           */
          function proceed() {

            /**
             * Aus Komponente erstellte Instanz
             * @type {ccm.Instance}
             */
            var instance = new ccm.components[ index ].Instance();

            // Instanz einordnen
            ccm.components[ index ].instances.push( instance );                    // In Komponente registrieren
            if ( upper_config && upper_key ) upper_config[ upper_key ] = instance; // In vorherigen Rekurionsstufe vermerken
            if ( !result ) result = instance;                                      // Ergebnis-Instanz vermerken

            // Instanz konfigurieren
            instance.id = ccm.components[ index ].instances.length;           // (Eindeutige) Instanz-ID hinzufügen
            instance.index = index +  '-' + instance.id;                      // (Eindeutigen) Instanz-Index hinzufügen
            instance.component = ccm.components[ index ];                     // Referenz auf Ursprungskomponente hinzufügen
            ccm.helper.integrate( ccm.components[ index ].config, instance ); // Standard-Konfiguration integrieren
            if ( config ) ccm.helper.integrate( config, instance );           // Benutzer-Konfiguration integrieren

            // Abhängigkeiten auflösen
            solveDependencies( instance );

            // Runterzählen
            counter--;

            // Prüfen ob alle Abhängigkeiten aufgelöst sind
            return check();

            /**
             * Durchsucht eine Instanz nach aufzulösenden Abhängigkeiten
             * @param {ccm.Instance} instance - Instanz
             */
            function solveDependencies( instance ) {

              // Eigenschaften der Instanz durchgehen
              for ( var key in instance ) {

                // Aufzulösende Abhängigkeit? => Auflösen
                if ( isDependency( instance, key ) ) solveDependency( instance, key );
              }

              /**
               * Prüft Instanz-Eigenschaft auf aufzulösende Abhängigkeit
               * @param {ccm.Instance} instance - Instanz
               * @param {string} key - Key der Instanz-Eigenschaft
               * @returns {boolean}
               */
              function isDependency( instance, key ) {

                if ( jQuery.isArray( instance[ key ] ) )
                  if ( instance[ key ].length > 0 )
                    if ( typeof ( instance[ key ][ 0 ] ) === 'function' )
                      return true;

                return false;
              }

              /**
               * Auflösen einer Abhängigkeit
               * @param {ccm.Instance} instance - Instanz
               * @param {string} key - Key der Instanz-Eigenschaft die Abhängigkeit enthält
               */
              function solveDependency( instance, key ) {

                /**
                 * Aufzulösende Abhängigkeit
                 * @type {ccm.Action}
                 */
                var action = instance[ key ];

                // Benötigte Instanz oder Datenspeicher?
                if ( action[ 0 ] === ccm.create ) {

                  // Instanz? => Erstellen
                  if ( typeof ( action[ 1 ] ) !== 'object' )
                    recursive( action[ 1 ], action[ 2 ], instance, key ); // rekursiver Aufruf
                  // Datenspeicher => Erstellen
                  else
                    { counter++; ccm.create( action[ 1 ], finish ); }
                }

                // Benötigte Ressource?
                if ( action[ 0 ] === ccm.load ) {

                  // Keine CSS-Datei? => Hochzählen
                  if ( action[ 1 ].indexOf( '.css' ) === -1 ) counter++;

                  // Ressource oder Daten nachladen
                  ccm.load( action[ 1 ], action[ 2 ], finish );
                }

                /**
                 * Auflösen der Abhängigkeit abschließen
                 * @param result
                 */
                function finish( result ) { counter--; instance[ key ] = result; check(); }

              }

            }

            /**
             * Prüft ob alle Abhängigkeiten aufgelöst sind
             * @returns {ccm.Instance} Erstellte Instanz (nur wenn synchron)
             */
            function check() {

              // Alle Ressourcen geladen?
              if ( counter === 0 ) {

                // Warteliste nicht leer? => Abbrechen und Abarbeiten
                if ( waiter.length > 0 ) return ccm.helper.action( waiter.shift() );

                // Erstellte Instanzen initialisieren
                initialize( result );

                // Callback mit erstellter Instanz aufrufen
                if ( callback ) callback( result );
              }

              // Erstellte Instanz zurückgeben
              return counter === 0 ? result : null;
            }

            /**
             * Initialisiert und startet eine Instanz und (danach) ihre benötigten Instanzen
             * @param {ccm.Instance} instance - Instanz
             */
            function initialize( instance ) {

              // Instanz initialisieren
              if ( instance.init ) instance.init();

              // Benötigte Instanzen initialisieren
              for ( var key in instance )
                if ( instance[ key ] === 'object' )
                  if ( instance[ key ].component )
                    initialize( instance[ key ] );

              // Instanz starten
              if ( instance.start && instance.autostart ) instance.start();
            }

          }

        }

      }

      /**
       * Erstellt einen Datenspeicher
       * @param {ccm.DataSettings} [settings] - Einstellungen
       * @returns {ccm.Datastore} Datenspeicher (nur wenn synchron)
       */
      function createDatastore( settings ) {

        // Nichts übergeben? => Leeres Objekt
        if ( !settings ) settings = {};

        // Kein lokaler Datenspeicher? => Leeres Objekt
        if ( !settings.local ) settings.local = {};

        // Startinhalt von Serverschnittstelle nachladen, falls notwendig
        return typeof ( settings.local ) === 'string' ? ccm.load( settings.local, proceed ) : proceed( settings.local );

        /**
         * Fortfahren mit Erstellung des Datenspeichers
         * @param {ccm.Data} data - Startinhalt für Datenspeicher
         * @returns {ccm.Datastore} Datenspeicher
         */
        function proceed( data ) {

          // Startinhalt in Einstellungen vermerken
          settings.local = data;

          // ccm-Datenbank vorbereiten, falls notwendig
          return settings.store ? prepareDB( proceed ) : proceed();

          /**
           * Vorbereiten der ccm-Datenbank
           * @param {function} callback - Callback
           */
          function prepareDB( callback ) {

            // ccm-Datenbank öffnen, falls notwendig
            !db ? openDB( proceed ) : proceed();

            /**
             * Öffnet die ccm-Datenbank der IndexedDB
             * @param {function} callback - Callback
             */
            function openDB( callback ) {

              // Aktuelle Version der ccm-Datenbank öffnen
              var request = indexedDB.open( 'ccm' );

              // Wenn Datenbank erfolgreich geöffnet
              request.onsuccess = function () {

                // Datenbank-Objekt vermerken
                db = this.result;

                // Callback aufrufen
                callback();
              };
            }

            /**
             * Fortfahren mit Erstellung des Datenspeichers
             * @returns {ccm.Datastore} Datenspeicher
             */
            function proceed() {

              // Neuen Objektspeichern anlegen, falls notwenig
              !db.objectStoreNames.contains( settings.store ) ? updateDB( callback ) : callback();

              /**
               * Aktualisiert die ccm-Datenbank der IndexedDB
               * @param {function} callback - Callback
               */
              function updateDB( callback ) {

                /**
                 * Aktuelle Versionsnummer der ccm-Datenbank
                 * @type {number}
                 */
                var version = parseInt( localStorage.getItem( 'ccm' ) );

                // Keine Versionsnummer? => Version 1
                if ( !version ) version = 1;

                // ccm-Datenbank schließen
                db.close();

                // ccm-Datenbank mit neuer Versionsnummer öffnen
                var request = indexedDB.open( 'ccm', version + 1 );

                // Wenn Datenbank mit neuer Versionsnummer geöffnet wird
                request.onupgradeneeded = function () {

                  // Datenbank-Objekt vermerken
                  db = this.result;

                  // Neue Versionsnummer speichern
                  localStorage.setItem( 'ccm', db.version );

                  // Neuen Objektspeicher erstellen
                  db.createObjectStore( settings.store, { keyPath: 'key' } );
                };

                // Wenn Datenbank erfolgreich aktualisiert => Callback aufrufen
                request.onsuccess = callback;
              }

            }

          }

          /**
           * Fortfahren mit Erstellung des Datenspeichers
           * @returns {ccm.Datastore} Datenspeicher
           */
          function proceed() {

            /**
             * Erstellter Datenspeicher
             * @type {ccm.Datastore}
             */
            var datastore = new Datastore();

            // Datenspeicher konfigurieren
            ccm.helper.integrate( settings, datastore );

            // Datenspeicher einordnen
            ccm.datastores.push( datastore );  // In ccm registrieren

            // Callback mit Datenspeicher aufrufen
            if ( callback ) callback( datastore );

            // Datenspeicher zurückgeben
            return datastore;
          }

        }

      }

    },

    /**
     * @summary Hilfsfunktionen für Komponentenentwickler
     * @memberOf ccm
     * @namespace
     * @type {Object.<string, function>}
     */
    helper: {

      /**
       * @summary Führt Aktion aus (# für Kontext)
       * @param {ccm.Action} action - Auszuführende Aktion
       * @param {object} [context] - Kontext
       * @returns {*} Rückgabewert der Aktion
       */
      action: function ( action, context ) {

        // Funktion angegeben?
        if ( typeof action === 'function' ) {

          // Aufrufen
          return action();
        }

        // Funktionsname und Parameter als String angegeben?
        if ( typeof action !== 'object' ) {

          // In Array verpacken
          action = action.split( ' ' );
        }

        // Aktion ausführen
        if ( typeof action[ 0 ] === 'function' )
          return action[ 0 ].apply( window, action.slice( 1 ) );
        else
          if ( action[ 0 ].indexOf( 'this.' ) === 0 )
            return this.executeByName( action[ 0 ].substr( 5 ), action.slice( 1 ), context );
          else
            return this.executeByName( action[ 0 ], action.slice( 1 ) );
      },

      /**
       * @summary Erstellt echte (tiefe) Kopie
       * @param {object} obj - Objekt
       * @param {boolean} [flat=false] - true: Flache Kopie, false: Tiefe Kopie (default)
       * @returns {object} Kopie
       */
      clone: function ( obj, flat ) {

        return typeof( obj ) === 'object' ? jQuery.extend( !flat, {}, obj ) : undefined;
      },

      /**
       * @summary Wertet Formular aus
       * @param {ccm.Element} form - DOM-Element des Formulars
       * @returns {Object.<string, string>} Ergebnisdaten
       */
      evaluateForm: function ( form ) {

        // Checkboxen selektieren
        form.find( 'input[type=checkbox]' ).each( function () {

          /**
           * Selektierte Checkbox
           * @type {ccm.Element}
           */
          var checkbox = jQuery( this );

          // Checkbox nicht gesetzt?
          if ( !checkbox.is( ':checked' ) ) {

            // Alten Ergebniswert merken
            checkbox.attr( 'data-input', checkbox.attr( 'value' ) );

            // Leerer String als Ergebniswert setzen
            checkbox.attr( 'value', '' );
          }

          // Checkbox in jedem Fall Ergebniswert liefern lassen
          checkbox.prop( 'checked', true );
        });

        /**
         * Ergebnisdaten
         * @type {Array}
         */
        var data = form.serializeArray();

        // Nicht gesetzte Checkboxen selektieren
        form.find( 'input[type=checkbox][value=""]' ).each( function() {

          /**
           * Selektierte Checkbox
           * @type {ccm.Element}
           */
          var checkbox = jQuery( this );

          // Checkbox zurücksetzen
          checkbox.prop( 'checked', false );
          checkbox.attr( 'value', checkbox.attr( 'data-input' ) );
          checkbox.removeAttr( 'data-input' );
        });

        /**
         * Umgewandelte Ergebnisdaten
         * @type {Object.<string, string>}
         */
        var result = {};

        // Ergebnisdaten umwandeln
        for ( var i = 0; i < data.length; i++ )
          result[ data[ i ][ 'name' ] ] = data[ i ][ 'value' ];

        // Ergebnisdaten zurückgeben
        return result;
      },

      /**
       * @summary Ruft anhand des Namens eine Funktion auf
       * @param {string} functionName - Name der Funktion
       * @param {Array} args - Zu übergebene Parameter
       * @param {object} [context] - Kontext
       * @returns {*} Rückgabewert der Funktion
       */
      executeByName: function ( functionName, args, context ) {

        if (!context) context = window;
        var namespaces = functionName.split( '.' );
        functionName = namespaces.pop();
        for ( var i = 0; i < namespaces.length; i++ )
          context = context[ namespaces[ i ]];
        return context[ functionName ].apply( context, args );
      },

      /**
       * @summary Entfernt identische Einträge aus Prioritätsdaten
       * @param {object} priodata - Prioritätsdaten
       * @param {object} dataset - Datensatz
       * @returns {object} Gefilterte Prioritätsdaten
       */
      filter: function ( priodata, dataset ) {

        // Kopie von Prioritätsdaten verwenden
        priodata = ccm.helper.clone( priodata );

        // Identische Einträge entfernen
        for ( var i in priodata )
          if ( priodata[ i ] === dataset[ i ] )
            delete priodata[ i ];
      },

      /*
       * @summary Schaltet Inhalt eines Containers auf Vollbildmodus
       * TODO: Vollbildmodus
       *
      fullscreen: function ( container ) {

        //var html = jQuery( 'body' ).clone();
        //jQuery( 'body' ).html( html );
//        jQuery( 'body' ).html( container );
//        container.click( function () { jQuery( 'body' ).html( html ); } );
      },
      */

      /**
       * @summary Integriert Prioritätsdaten in Datensatz
       * @param {object} [priodata] - Prioritätsdaten
       * @param {object} [dataset] - Datensatz
       * @returns {object} Aktualisierter Datensatz
       */
      integrate: function ( priodata, dataset ) {

        // Keine Prioritätsdaten?
        if ( !priodata ) {

          // Datensatz zurückgeben
          return dataset;
        }

        // Kein Datensatz?
        if ( !dataset ) {

          // Prioritätsdaten zurückgeben
          return priodata;
        }

        // Prioritätsdaten durchgehen
        for ( var i in priodata ) {

          // Wert in Datensatz ändern
          if ( priodata[ i ] !== undefined )
            dataset[ i ] = priodata[ i ];
          else
            delete dataset[ i ];
        }

        // Datensatz zurückgeben
        return dataset;
      },

      /**
       * @summary Reselektiert das DOM-Element einer Instanz
       * @param {ccm.Instance} instance - Instanz
       */
      reselect: function ( instance ) {

        // DOM-Element gesetzt? => Reselektieren
        if ( instance.element ) instance.element = jQuery( instance.element.selector );
      },

      /**
       * @summary Erstellt einen Tag und liefert DOM-Element
       * @param {ccm.Input|ccm.Input[]} dataset - Datensatz für Tag
       * @returns {ccm.Element} DOM-Element des Tags
       */
      tag: function( dataset ) {

        // Sollen mehrere Tags erstellt werden?
        if ( jQuery.isArray( dataset ) ) {

          // Tags erstellen und DOM-Elemente als Array zurückgeben
          var result = [];
          for ( var j = 0; j < dataset.length; j++ )
            result.push( ccm.helper.tag( dataset[ j ] ) );
          return result;
        }

        /**
         * DOM-Element für Tag
         * @type {ccm.Element}
         */
        var element = jQuery( '<' + dataset.tag + '>' );

        // Datensatz durchgehen
        for ( var key in dataset ) {
          var value = dataset[ key ];

          switch ( key ) {

            // Attribute
            case 'action':
            case 'type':
            case 'name':
            case 'value':
            case 'pattern':
            case 'title':
            case 'for':
            case 'id':
            case 'class':
              element.attr( key, value );
              break;

            // Flags
            case 'checked':
            case 'selected':
            case 'required':
              element.prop( key, true );
              break;

            // Inhalt
            case 'content':
              if ( typeof ( value) === 'string' )
                element.html( value );
              if ( jQuery.isPlainObject( value ) )
                element.append( this.tag( value ) );
              if ( jQuery.isArray( value ) )
                for ( var i = 0; i < value.length; i++ )
                  element.append( this.tag( value[ i ] ) );
              break;

            // Events
            case 'onClick':
              element.click( value );
              break;
            case 'onChange':
              element.change( value );
              break;
            case 'onSubmit':
              element.submit( value );
              break;

            // Beliebige Daten
            default:
              if ( key.indexOf( 'data-' ) === 0 )
                element.attr( key, value );
          }
        }

        // DOM-Element für Tag zurückgeben
        return element;
      },

      /**
       * @summary Prüft ob Element im DOM existiert
       * @param {ccm.Element} element - DOM-Element
       * @returns {boolean}
       */
      tagExists: function ( element ) {

        // Existenz prüfen
        return element.closest( 'html' ).length > 0;
      },

      /**
       * @summary Ruft Funktion nach Wartezeit auf
       * @param {number} time - Wartezeit [in ms]
       * @param {function} callback - Nach Wartezeit aufzurufende Funktion
       */
      wait: function ( time, callback ) {

        // Geforderte Zeit warten
        window.setTimeout( callback, time );
      }
    }
  };


  /*---------------------------- Private Methods -----------------------------*/

  /**
   * @summary Filtert Index aus Komponenten-Pfad
   * @private
   * @param {string} path - Pfad zur Komponente
   * @returns {ccm.Index}
   */
  function filterIndex( path ) {

    return path.split( '/' ).pop().split( '.' )[ 0 ];
  }


  /*---------------------------- Type Definitions ----------------------------*/

  /**
   * @summary (Eindeutiger) Index einer Komponente
   * @typedef {string} ccm.Index
   */

  /**
   * @summary Komponente
   * @typedef {namespace} ccm.Component
   * @property {ccm.Index} index - (Eindeutiger) Index der Komponente
   * @property {function} init - Wird (falls vorhanden) einmalig aufgerufen wenn Komponente geladen wurde
   * @property {function} Instance - Bauplan für Instanzen (Konstruktor)
   * @property {ccm.Config} config - Standardkonfiguration für Instanzen
   * @property {function} create - Erstellt Instanz aus Komponente
   * @property {ccm.Instance[]} instances - Erstellte Instanzen
   */

  /**
   * @summary Instanz einer Komponente
   * @typedef {object} ccm.Instance
   * @property {number} id - (Eindeutige) Instanz-ID
   * @property {string} index - (Eindeutiger) Instanz-Index
   * @property {ccm.Instance} self - Eigener Kontext (private)
   * @property {ccm.Element} element - DOM-Element
   * @property {ccm.Style} style - CSS für DOM-Element
   * @property {function} init - Wird (falls vorhanden) einmalig aufgerufen wenn Instanz erstellt wurde
   * @property {function} start - Startet Manipulation des DOM-Elements
   * @property {ccm.Component} component - Referenz auf Ursprungskomponente
   * @property {boolean} autostart - Instanz nach Erstellung direkt starten
   */

  /**
   * @summary Konfiguration einer Instanz (siehe Dokumentation der Komponente)
   * @typedef {object} ccm.Config
   * @property {ccm.Element} element - DOM-Element
   * @property {ccm.Style} style - CSS für DOM-Element
   * @property {boolean} autostart - Instanz nach Erstellung direkt starten
   */

  /**
   * @summary Aufzulösende Abhängigkeit einer Instanz
   * @typedef {Array} ccm.Require
   * @example [ ccm.load, ... ]
   * @example [ ccm.create, ... ]
   */

  /**
   * @summary Datenspeicher
   * @typedef {object} ccm.Datastore
   * @property {ccm.Datastore} self - Eigener Kontext (private)
   * @property {object} local - Startinhalt des Datenspeichers oder URL zu einer den Startinhalt liefernder Serverschnittstelle
   * @property {string} store - Name des Objektspeichers in der clientseitigen Datenbank (IndexedDB)
   * @property {string} url - URL der Serverschnittstelle zur serverseitigen Datenbank
   * @property {function} get - Liefert Datensatz
   * @property {function} set - Setzt Datensatz
   * @property {function} del - Löscht Datensatz
   */

  /**
   * @summary Einstellungen für neuen Datenspeicher
   * @typedef {object} ccm.DataSettings
   * @property {object} local - Startinhalt des Datenspeichers oder URL zu einer den Startinhalt liefernder Serverschnittstelle
   * @property {string} store - Name des Objektspeichers in der clientseitigen Datenbank (IndexedDB)
   * @property {string} url - URL der Serverschnittstelle zur serverseitigen Datenbank
   */

  /**
   * @summary Inhalt eines Datenspeichers
   * @typedef {Object.<ccm.Key, ccm.Dataset>} ccm.Data
   */

  /**
   * @summary Datensatz
   * @typedef {object} ccm.Dataset
   * @property {ccm.Key} key - (Eindeutiger) Key des Datensatzes
   */

  /**
   * @summary Eindeutiger Schlüssel für Datensatz
   * @typedef {string|number} ccm.Key
   */

  /**
   * @summary Auszuführende Aktion
   * @typedef {function|string|Array} ccm.Action
   * @example function() { ... }
   * @example functionName
   * @example 'functionName'
   * @example 'my.namespace.functionName'
   * @example ['my.namespace.functionName','param1','param2']
   */

  /**
   * @summary Datensatz für Erstellung eines Tags
   * @typedef {object} ccm.Input
   * @property {string} tag - Name des Tags
   * @property {string} action - action-Attribut (bei Formular)
   * @property {string} type - type-Attribut (bei input-Tag)
   * @property {string} name - name-Attribut
   * @property {string} value - value-Attribut
   * @property {string} pattern - pattern-Attribut (bei input-Tag)
   * @property {string} for - for-Attribut (bei Label)
   * @property {string} id - id-Attribut
   * @property {string} class - class-Attribut
   * @property {boolean} checked - checked-Flag (bei Checkbox)
   * @property {boolean} selected - selected-Flag (bei Auswahlliste)
   * @property {boolean} required - required-Flag (bei input-Tag)
   * @property {string|ccm.Input[]} content - Inhalt des Tags
   * @property {function} onClick - Click-Event
   * @property {function} onChange - Change-Event (bei Auswahlliste)
   * @property {function} onSubmit - Submit-Event (bei Formular)
   */

  /**
   * @summary "jQuery Element"-Objekt
   * @typedef {object} ccm.Element
   * @example jQuery( 'body' )
   */

  /**
   * @summary "jQuery XMLHttpRequest"-Objekt
   * @typedef {object} ccm.JqXHR
   */

}();

