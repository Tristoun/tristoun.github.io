<?php
  session_start();
  $db = new SQLite3("myDatabase.sqlite");

  if(!isset($_SESSION["id_player"])) {
      header('Location: login.php');
  }
  $idPlayer = $_SESSION["id_player"];

  function setIdPlayerGame($id, $nb, $gameId, $db) {
    $query = "UPDATE game SET id_player_$nb = $id WHERE id_game = $gameId";
    $result = $db->exec($query);
    if($result) {
      $_SESSION["gameId"] = $gameId;
      header("Location: car.php");
      exit;
    }
    else {
      echo "Error";
    }
  }
  
  function joinGame($idPlayer, $gameId, $db) {
    $query = "SELECT id_player_1, id_player_2 FROM game WHERE id_game = $gameId";
    $result = $db->query($query);
    if($row = $result->fetchArray()) {
      $idPlayer1 = $row["id_player_1"];
      $idPlayer2 = $row["id_player_2"];
      if($idPlayer1 == $idPlayer || $idPlayer2 == $idPlayer) {
        $_SESSION["gameId"] = $gameId;
        header("Location: car.php");
        exit;
      }
      if($idPlayer1 == null) {
        setIdPlayerGame($idPlayer, 1, $gameId, $db);
      }
      else if ($idPlayer2 == null) {
        setIdPlayerGame($idPlayer, 2, $gameId, $db);
      }
      else {
        echo "Game is full";
    }
      }
    }

  // echo '<pre>';
  // var_dump($_SESSION);
  // echo '</pre>';

  if($_POST["gameId"]) {
    joinGame($idPlayer, $_POST["gameId"], $db);
  }
  // echo $_POST["gameId"];

?>

<!DOCTYPE html>
<?php include("inc/header.php");?>

  <div class="py-10">
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <h1 class="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Game list</h1>
    </div>
    <main>
      <script>
        function addGame(nb) {
          const divList = document.getElementById("gameList");

          const div1 = document.createElement("div");
          div1.className = "border-b border-gray-200 px-4 py-5 sm:px-6 dark:border-white/10"
          
          const div2 = document.createElement("div");
          div2.className = "-mt-2 -ml-4 flex flex-wrap items-center justify-between sm:flex-nowrap"

          const div3 = document.createElement("div");
          div3.className = "mt-2 ml-4"

          const h31 = document.createElement("h3");
          h31.className = "text-base font-semibold text-gray-900 dark:text-white"
          h31.textContent = `Game ${nb}`

          const divButton = document.createElement("div");
          divButton.className = "mt-2 ml-4 shrink-0"
          const button = document.createElement("button");
          button.className = "elative inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:bg-indigo-500 dark:shadow-none dark:hover:bg-indigo-400 dark:focus-visible:outline-indigo-500"
          button.textContent = "Join game";

          divButton.appendChild(button);
          div3.appendChild(h31);
          div2.appendChild(div3);
          div2.appendChild(divButton);
          div1.appendChild(div2);

          divList.appendChild(div1);
        }

      </script>
      <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8" id="gameList">
        <!-- Your content -->
          <?php 

            function addGame($nb) {
                return '
                <form method="POST" action="">
                  <div class="border-b border-gray-200 px-4 py-5 sm:px-6 dark:border-white/10">
                      <div class="-mt-2 -ml-4 flex flex-wrap items-center justify-between sm:flex-nowrap">
                          <div class="mt-2 ml-4">
                              <h3 class="text-base font-semibold text-gray-900 dark:text-white">
                                  Game ' . htmlspecialchars($nb) . '
                              </h3>
                          </div>

                          <div class="mt-2 ml-4 shrink-0">
                              <button class="relative inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:bg-indigo-500 dark:shadow-none dark:hover:bg-indigo-400 dark:focus-visible:outline-indigo-500">
                                  Join game
                              </button>
                          </div>
                      </div>
                  </div>
                  <input type="hidden" id="gameId" name="gameId" value='.$nb.' />
                </form>';
            }



            $database = new SQLite3('myDatabase.sqlite');
            $query = "SELECT id_game FROM game";
            $result = $database->query($query);

            while ($row = $result->fetchArray()) {
                echo addGame($row['id_game']);
            }
          ?>
      </div>
    </main>
  </div>
</div>
</div>
</body>
</html>
