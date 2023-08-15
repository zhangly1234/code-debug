# 怎么保留进程的名字信息
ProcessControlBlock 有四个函数：
 new() 用于创建initproc. 此处的修改很简单：
 fork() 用于fork. 这个也很简单，fork的时候添加一个参数就行。因为fork前后，名字是保持不变的。如果fork后再exec情况就不一样了。具体可以看下一节。：
 exec() 略微复杂。首先我们要明白exec()干什么：
In computing, exec is a functionality of an operating system that runs an executable file in the context of an already existing process, replacing the previous executable. This act is also referred to as an overlay. 
也就是说， exec() 覆盖了现有的资源，不会创造新的进程控制块。因此，在exec()中，我们直接更改当前进程的path信息：

下面这个是错误的结论。exec()如果成功执行的话，是不会返回的。initproc.rs里面有两个exec()是因为，如果第一个执行失败了，还有第二个exec兜底。代码：
~~此外还有个容易忽略的地方：exec()函数会返回到原来的函数继续执行，因此，我们要在“返回到原来的函数继续执行”这个流程中，恢复exec()前的path. 否则，在调用exec()后path就不正确了，这是一个容易忽略的地方。查rCore-Tutorial-v3文档得到函数是 （注意这个不是调度用的那个idle函数）:~~


我发现一边写代码一边写文档效率是比较高的。如果事后写文档的话，回忆起来很累，而且回忆得不完整。