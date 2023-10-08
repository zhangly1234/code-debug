相关文档
Debugger Extension | Visual Studio Code Extension API
code-debug/HACKING.md at master · WebFreak001/code-debug (github.com)


我的理解
code-debug插件是分为两部分的，extension和调试适配器（DA），这两部分是由两个进程来控制，所以如果调试的话应该是启动两个调试配置，一个是launch extension，另一个是server。
前者是调试extension的部分，更具体地说是extension.ts文件，用它调试就会启动一个新窗口（扩展开发宿主)；
后者是调试调试适配器的部分，也就是除了extension.ts文件地其他文件，这部分的调试需要进行一个配置，在code-debug中的launch.json已经配置好了，是一个叫做code-debug sever的调试配置，里面有一个4711的端口号，启动这个配置以后，他会监听这个端口号，所以，在我们要调试的项目（rCore-Tutorial-v3）中，也要添加一个 "debugServer": 4711,的配置，使两者可以传递信息。

具体调试步骤：
在code-debug中找到调试的界面，选择launch extension，然后按F5，启动一个新窗口，在新窗口中选择我们要调试的项目（rCore-Tutorial-v3）打开，然后不要动。
回到code-debug的调试界面，点击调试和运行的下拉框，选择code-debug sever，点击绿色的开始调试按钮，就会发现他多了一个调试配置，如下图。
图片: https://uploader.shimo.im/f/jjr5mQl9irsR1hNS.png!thumbnail?accessToken=eyJhbGciOiJIUzI1NiIsImtpZCI6ImRlZmF1bHQiLCJ0eXAiOiJKV1QifQ.eyJleHAiOjE2OTY3NzE5MDMsImZpbGVHVUlEIjoibTRrTUxLbnZScHNCNkRxRCIsImlhdCI6MTY5Njc3MTYwMywiaXNzIjoidXBsb2FkZXJfYWNjZXNzX3Jlc291cmNlIiwidXNlcklkIjo1NDkwMjk4Mn0.hd5Sng9_TdEPdEabNjXXR8EsAdisL9u2zTNb2kl52G8
接下来，回到新窗口，按F5，按照正常的调试流程进行操作，他会触发在文件中设置的断点（推荐的断点位置mibase.ts中的handleBreakpoint（）函数中）。

关于断点设置：尽量不要在extension.ts里面设置断点，因为他会卡在那里，然后终止程序。
关于console.log函数的输出：对于上面两个启动配置，他也会有两个调试控制台，在不同文件中的输出会在不同的调试控制台中。

