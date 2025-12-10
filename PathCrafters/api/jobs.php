<?php
require "db.php";

// Get job names
$sql = "SELECT Job_name FROM Jobs";

$result = $conn->query($sql);

$jobs = [];

while ($row = $result->fetch_assoc()) {
    $jobs[] = $row;
}

echo json_encode($jobs);
?>
