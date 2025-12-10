<?php
require "db.php";

if (!isset($_GET["name"])) {
    echo json_encode(["error" => "No job name provided"]);
    exit;
}

$jobName = $_GET["name"];

$sql = "
    SELECT 
        j.JobID,
        j.Job_name,
        j.Final_degree,
        j.years_needed,
        j.avgCost,
        j.Salary,
        m.MajorID,
        m.Major_name,
        m.CreditHrs,
        m.focus
    FROM Jobs j
    LEFT JOIN Major_Jobs mj ON j.JobID = mj.JobID
    LEFT JOIN Major m ON mj.MajorID = m.MajorID
    WHERE j.Job_name = ?
";

$stmt = $conn->prepare($sql);
$stmt->bind_param("s", $jobName);
$stmt->execute();
$result = $stmt->get_result();

$data = [];

while ($row = $result->fetch_assoc()) {
    $data[] = $row;
}

if (count($data) === 0) {
    echo json_encode(["error" => "No job found"]);
    exit;
}

$job = [
    "JobID"        => $data[0]["JobID"],
    "Job_name"     => $data[0]["Job_name"],
    "Final_degree" => $data[0]["Final_degree"],
    "years_needed" => $data[0]["years_needed"],
    "avgCost"      => $data[0]["avgCost"],
    "majors"       => []
];

foreach ($data as $row) {
    $job["majors"][] = [
        "MajorID"    => $row["MajorID"],
        "Major_name" => $row["Major_name"],
        "CreditHrs"  => $row["CreditHrs"]
    ];
}

echo json_encode($job);
?>
