/**
 * @overview ccm component for simple chats
 * @author André Kless <andre.kless@web.de> 2016
 */
ccm.component( {

  name: 'chat',

  config: {

    html:  [ ccm.store, { local: 'templates.json' } ],
    key:   'test',
    store: [ ccm.store, { url: 'ws://ccm2.inf.h-brs.de/index.js', store: 'chat' } ],
    style: [ ccm.load, 'style.css' ],
    user:  [ ccm.instance, 'https://kaul.inf.h-brs.de/ccm/components/user2.js' ]

  },

  Instance: function () {

    var self = this;

    self.init = function ( callback ) {

      self.store.onChange = function () { self.render(); };

      callback();

    };

    self.render = function ( callback ) {

      var element = ccm.helper.element( self );

      self.store.get( self.key, function ( dataset ) {

        if ( dataset === null )
          self.store.set( { key: self.key, messages: [] }, proceed );
        else
          proceed( dataset );

        function proceed( dataset ) {

          element.html( ccm.helper.html( self.html.get( 'main' ) ) );

          var messages_div = ccm.helper.find( self, '.messages' );

          for ( var i = 0; i < dataset.messages.length; i++ ) {

            var message = dataset.messages[ i ];

            messages_div.append( ccm.helper.html( self.html.get( 'message' ), {

              name: ccm.helper.val( message.user ),
              text: ccm.helper.val( message.text )

            } ) );

          }

          messages_div.append( ccm.helper.html( self.html.get( 'input' ), { onsubmit: function () {

            var value = ccm.helper.val( ccm.helper.find( self, 'input' ).val() ).trim();

            if ( value === '' ) return;

            self.user.login( function () {

              dataset.messages.push( { user: self.user.data().key, text: value } );

              self.store.set( dataset, function () { self.render(); } );

            } );

            return false;

          } } ) );

          if ( callback ) callback();

        }

      } );

    };

  }

} );