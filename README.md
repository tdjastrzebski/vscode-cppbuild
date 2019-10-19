# What is it?
**Build++** is **VS Code** multi-step build tool extension which allows to build C/C++ projects based on [vscode-cpptools](https://marketplace.visualstudio.com/items?itemName=ms-vscode.cpptools) `includePath`, `defines` and `forcedInclude` variables combined with its own build steps.  
**Build++** runs [cppbuild](https://github.com/tdjastrzebski/cppbuild/) command line utility using tasks it creates 'on the fly'.

# How to use it?
1. Install command line [cppbuild](https://github.com/tdjastrzebski/cppbuild/) tool: `npm install cppbuild -g`
1. Go to menu **Terminal** and choose **Run Task...** option.  
You should see additional build tasks available.
1. Modify created `c_cpp_build.json` file according to your needs.  
Detailed `c_cpp_build.json` file description is available at [cppbuild](https://github.com/tdjastrzebski/cppbuild/) GitHub site.

### Note
1. `c_cpp_build.json` file must contain configurations named exactly as those defined in `c_cpp_properties.json` file.
1. Sample entry for Microsoft C++ compiler uses `env:ScopeCppSDK` environment variable. E.g. `C:\Program Files (x86)\Microsoft Visual Studio\2019\Enterprise\SDK\ScopeCppSDK`
1. Build can be run from command line as well. Example: `cppbuild GCC debug`  
Use `cppbuild --help` for more options.

# Why?
While working on C/C++ for embedded devices in VS Code I wanted to simplify multi-step build process configuration and maintenance. Also, I wanted to eliminate setting duplication (include paths and defines) between `c_cpp_properties.json` and widely used MAKE/CMake files.  
Although these tools are industry standard, I am not a big fan of them. All that led me to the development of a completely new build tool.  
Since [vscode-cpptools](https://marketplace.visualstudio.com/items?itemName=ms-vscode.cpptools) extension is popular and widely used, I adjusted to the status quo and used `c_cpp_properties.json` as it was, instead of supplying my own settings via [vscode-cpptools-api](https://github.com/Microsoft/vscode-cpptools-api).