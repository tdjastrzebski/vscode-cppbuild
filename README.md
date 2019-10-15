# What is it?
**Build++** is a custom **VS Code** extension which allows to build C/C++ projects based on **vscode-cpptools** `includePath`, `defines` and `forcedInclude` variables combined with its own build steps.

# Why?
While working on C/C++ for embedded devices in VS Code I wanted to simplify multi-step build process configuration and maintenance. Also, I wanted to eliminate setting duplication (include paths and defines) between `c_cpp_properties.json` and widely used MAKE/CMake files. Although these tools are industry standard, I am not a big fan of them. All that led me to the development of a completely new build tool.  
Since [ms-vscode.cpptools](https://marketplace.visualstudio.com/items?itemName=ms-vscode.cpptools) extension is popular and widely used, I adjusted to the status quo and used `c_cpp_properties.json` as it was, instead of supplying my own settings via [vscode-cpptools-api](https://github.com/Microsoft/vscode-cpptools-api).

# What does it do?
**Build++** extension runs command line [cppbuild](https://github.com/tdjastrzebski/cppbuild/) utility using tasks it creates based on configurations available in `c_cpp_properties.json` and `c_cpp_build.json` files.

# How to use it?
Go to Terminal and choose Run Task..  
Modify created `c_cpp_build.json` file according to your needs.  
`c_cpp_build.json` file description is available at [cppbuild](https://github.com/tdjastrzebski/cppbuild/).