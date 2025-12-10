<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: *");

$host = "fdb1034.atspace.me";
$port = 3306; 
$user = "4702744_advisor";
$pass = "SeniorProj25";
$dbname = "4702744_advisor";

$conn = new mysqli($host, $user, $pass, $dbname, $port);

if ($conn->connect_error) {
    die(json_encode(["error" => "Database connection failed: " . $conn->connect_error]));
}
?>
