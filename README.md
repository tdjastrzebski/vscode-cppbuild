# What is it?
**Build++** is **VS Code** multi-step build tool extension which allows to build C/C++ projects based on [vscode-cpptools](https://marketplace.visualstudio.com/items?itemName=ms-vscode.cpptools) `includePath`, `defines` and `forcedInclude` variables combined with its own build steps.  
**Build++** runs [cppbuild](https://github.com/tdjastrzebski/cppbuild/) command line utility using tasks it creates 'on the fly'.

# How to use it?
1. Install command line [cppbuild](https://github.com/tdjastrzebski/cppbuild/) tool: `npm install cppbuild -g`
1. Go to menu **Terminal** and choose **Run Task...** option.  
You should see additional build tasks available.  
By default, build output files are placed in `./build` folder.
1. Modify created `c_cpp_build.json` file according to your needs.  
Detailed `c_cpp_build.json` file description is available at [cppbuild](https://github.com/tdjastrzebski/cppbuild/) GitHub site.

# Notes
1. `c_cpp_build.json` file must contain configurations named exactly as those defined in `c_cpp_properties.json` file.
1. Executing tasks **VS Code** uses current or default terminal. Therefore, using shell-specific commands in build steps make sure correct terminal shell is active or selected as default.
1. Build can be run from command line as well. Example: `cppbuild GCC debug`
1. Build from command line can be run with or without `c_cpp_properties.json` file - since [cppbuild](https://github.com/tdjastrzebski/cppbuild/) version 1.1.0.
1. [cppbuild](https://github.com/tdjastrzebski/cppbuild/) is not limited to C/C++ builds. Use `cppbuild --help` for more options.

# Syntax Hints
1. Command is repeated for every file matching **filePattern** - if **filePattern** is specified.  
`${fileDirectory}`, `${filePath}` and `${fileName}` variables can be used in command.
1. In contrast, **fileList** defines `$${fileDirectory}`, `$${filePath}` and `$${fileName}` multi-valued variables, command is not repeated. 
1. **filePattern** and **fileList** are mutually exclusive and they use full [glob syntax](https://en.wikipedia.org/wiki/Glob_(programming)) syntax. E.g. exclusions can be specified.
1. Standard `${name}` variable syntax is used. `$${name}` denotes multi-valued variable. Environment variables `${env:name}` can be used as well.
1. `()` define sub-template. Sub-template can contain only one multi-valued variable.
1. Strings in `[]` are treated as paths and will be quoted if path contains whitespace. Path separators (\\ /) may be replaced if needed.  
`[]` containing multi-valued variable is treated as sub-template as well.
1. Other variables available: **workspaceRoot**/**workspaceFolder**, **workspaceRootFolderName**, **outputDirectory**, **buildTypeName**, **configName**, **includePath**, **defines** and **forcedInclude**. The last three come from `c_cpp_properties.json` file.

# Why?
While working on C/C++ for embedded devices in VS Code I wanted to simplify multi-step build process configuration and maintenance. Also, I wanted to eliminate setting duplication (include paths and defines) between `c_cpp_properties.json` and widely used MAKE/CMake files.  
Although these tools are industry standard, I am not a big fan of them. All that led me to the development of a completely new build tool.  
Since [vscode-cpptools](https://marketplace.visualstudio.com/items?itemName=ms-vscode.cpptools) extension is popular and widely used, I adjusted to the status quo and used `c_cpp_properties.json` as it was, instead of supplying my own settings via [vscode-cpptools-api](https://github.com/Microsoft/vscode-cpptools-api).

# Improvements and fixes
Any improvements, fixes or suggestions are more than welcome. Use on GitHub:  
https://github.com/tdjastrzebski/cppbuild/  
https://github.com/tdjastrzebski/vscode-cppbuild

# Known issues
1. Although created tasks are marked as Build Tasks, they do not appear in Build Tasks group. I suspect VS Code bug.
2. Occasionally output parts are not visible in Debug Console. The problem does not occur if cppbuild is run from the command prompt. I have no clue why that happens.