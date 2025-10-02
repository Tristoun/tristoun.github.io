<?php
session_start();
$db = new SQLite3("myDatabase.sqlite");
// Check if already logged in
if (isset($_SESSION["id_player"])) {
    header("Location: onlinegame.php");
    exit;
}

// Helper function to get player ID
function getIdPlayer($db, $email, $password) {
    $query = "SELECT id_player FROM player WHERE email = :email AND password = :pwd";
    $stmt = $db->prepare($query);
    $stmt->bindValue(":email", $email, SQLITE3_TEXT);
    $stmt->bindValue(":pwd", $password, SQLITE3_TEXT);
    $result = $stmt->execute();
    return $result->fetchArray(SQLITE3_ASSOC);
}

// Get POST data
$email = $_POST["email"] ?? null;
$password = $_POST["password"] ?? null;

if ($email && $password) {
    $player = getIdPlayer($db, $email, $password);
    var_dump($player);
    if ($player) {
        // Player exists, log in
        $_SESSION["id_player"] = $player["id_player"];
        header("Location: onlinegame.php");
        exit; // Important: stop execution after redirect
    } else {
        // Player doesn't exist, register
        $query = "INSERT INTO player (email, password) VALUES(:email, :pwd)";
        $stmt = $db->prepare($query);
        $stmt->bindValue(":email", $email, SQLITE3_TEXT);
        $stmt->bindValue(":pwd", $password, SQLITE3_TEXT);
        $stmt->execute();

        // Get ID of newly inserted player
        $player = getIdPlayer($db, $email, $password);
        var_dump($player);
        if ($player) {
            $_SESSION["id_player"] = $player["id_player"];
            header("Location: onlinegame.php");
            exit; // Stop execution after redirect
        } else {
            echo "Registration failed.";
        }
    }
} else {
    echo "Email and password required.";
}


?>

<!DOCTYPE html>
<html class="h-full bg-white dark:bg-gray-900">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Page</title>
    <link href="../dist/output.css" rel="stylesheet">

</head>
<body class="h-full">
<div class="flex min-h-full flex-col justify-center px-6 py-12 lg:px-8">
  <div class="sm:mx-auto sm:w-full sm:max-w-sm">
    <img src="https://tailwindcss.com/plus-assets/img/logos/mark.svg?color=indigo&shade=600" alt="Your Company" class="mx-auto h-10 w-auto dark:hidden" />
    <img src="https://tailwindcss.com/plus-assets/img/logos/mark.svg?color=indigo&shade=500" alt="Your Company" class="mx-auto h-10 w-auto not-dark:hidden" />
    <h2 class="mt-10 text-center text-2xl/9 font-bold tracking-tight text-gray-900 dark:text-white">Sign in to your account</h2>
  </div>

  <div class="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
    <form action="login.php" method="POST" class="space-y-6">
      <div>
        <label for="email" class="block text-sm/6 font-medium text-gray-900 dark:text-gray-100">Email address</label>
        <div class="mt-2">
          <input id="email" type="email" name="email" required autocomplete="email" class="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500" />
        </div>
      </div>

      <div>
        <div class="flex items-center justify-between">
          <label for="password" class="block text-sm/6 font-medium text-gray-900 dark:text-gray-100">Password</label>
        </div>
        <div class="mt-2">
          <input id="password" type="password" name="password" required autocomplete="current-password" class="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500" />
        </div>
      </div>

      <div>
        <button type="submit" class="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm/6 font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:bg-indigo-500 dark:shadow-none dark:hover:bg-indigo-400 dark:focus-visible:outline-indigo-500">Sign in</button>
      </div>
    </form>
  </div>
</div>

</body>
</html>
