<?php
header( 'Access-Control-Allow-Origin: *' );
header( "Access-Control-Allow-Headers: {$_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS']}" );
header( 'Content-Type: text/html' );
?>
Hello, <b>World</b>!