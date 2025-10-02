Html Webpack Plugin:
<pre>
  Error: Child compilation failed:
  Module not found: Error: Can't resolve '/home/tristan/Documents/Javascript/race_game/docs/car.php' in '/home/tristan/Documents/Javascript/race_game'
  ModuleNotFoundError: Module not found: Error: Can't resolve '/home/tristan/Documents/Javascript/race_game/docs/car.php' in '/home/tristan/Documents/Javascri  pt/race_game'
      at /home/tristan/Documents/Javascript/race_game/node_modules/webpack/lib/Compilation.js:2246:28
      at /home/tristan/Documents/Javascript/race_game/node_modules/webpack/lib/NormalModuleFactory.js:949:13
      at eval (eval at create (/home/tristan/Documents/Javascript/race_game/node_modules/tapable/lib/HookCodeFactory.js:33:10), <anonymous>:10:1)
      at /home/tristan/Documents/Javascript/race_game/node_modules/webpack/lib/NormalModuleFactory.js:347:22
      at eval (eval at create (/home/tristan/Documents/Javascript/race_game/node_modules/tapable/lib/HookCodeFactory.js:33:10), <anonymous>:9:1)
      at /home/tristan/Documents/Javascript/race_game/node_modules/webpack/lib/NormalModuleFactory.js:532:22
      at /home/tristan/Documents/Javascript/race_game/node_modules/webpack/lib/NormalModuleFactory.js:163:10
      at /home/tristan/Documents/Javascript/race_game/node_modules/webpack/lib/NormalModuleFactory.js:807:25
      at /home/tristan/Documents/Javascript/race_game/node_modules/webpack/lib/NormalModuleFactory.js:1034:8
      at /home/tristan/Documents/Javascript/race_game/node_modules/webpack/lib/NormalModuleFactory.js:1163:5
  
  - Compilation.js:2246 
    [race_game]/[webpack]/lib/Compilation.js:2246:28
  
  - NormalModuleFactory.js:949 
    [race_game]/[webpack]/lib/NormalModuleFactory.js:949:13
  
  
  - NormalModuleFactory.js:347 
    [race_game]/[webpack]/lib/NormalModuleFactory.js:347:22
  
  
  - NormalModuleFactory.js:532 
    [race_game]/[webpack]/lib/NormalModuleFactory.js:532:22
  
  - NormalModuleFactory.js:163 
    [race_game]/[webpack]/lib/NormalModuleFactory.js:163:10
  
  - NormalModuleFactory.js:807 
    [race_game]/[webpack]/lib/NormalModuleFactory.js:807:25
  
  - NormalModuleFactory.js:1034 
    [race_game]/[webpack]/lib/NormalModuleFactory.js:1034:8
  
  - NormalModuleFactory.js:1163 
    [race_game]/[webpack]/lib/NormalModuleFactory.js:1163:5
  
  - child-compiler.js:211 
    [race_game]/[html-webpack-plugin]/lib/child-compiler.js:211:18
  
  - Compiler.js:650 finalCallback
    [race_game]/[webpack]/lib/Compiler.js:650:5
  
  - Compiler.js:686 
    [race_game]/[webpack]/lib/Compiler.js:686:11
  
  - Compiler.js:1377 
    [race_game]/[webpack]/lib/Compiler.js:1377:17
  
  
  - Hook.js:20 Hook.CALL_ASYNC_DELEGATE [as _callAsync]
    [race_game]/[tapable]/lib/Hook.js:20:14
  
  - Compiler.js:1373 
    [race_game]/[webpack]/lib/Compiler.js:1373:33
  
  - Compilation.js:3079 finalCallback
    [race_game]/[webpack]/lib/Compilation.js:3079:11
  
  - Compilation.js:3422 
    [race_game]/[webpack]/lib/Compilation.js:3422:11
  
  
</pre><script defer src="game.bundle.js"></script>