<?php

header( 'Access-Control-Allow-Origin: *' );
header( "Access-Control-Allow-Headers: {$_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS']}" );

$response = array( 'foo' => 'bar' );

$response = json_encode( $response );
$callback = filter_input( INPUT_GET, 'callback', FILTER_SANITIZE_STRING );
if ( isset( $callback ) ) $response = $callback . '(' . $response . ');';

echo $response;

?>