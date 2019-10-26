# What is it?
**Build++** is **VS Code** multi-step build tool extension based on JSON, string templates and [glob syntax](https://en.wikipedia.org/wiki/Glob_(programming)).  
**Build++** can build C/C++ projects using [vscode-cpptools](https://marketplace.visualstudio.com/items?itemName=ms-vscode.cpptools) `includePath`, `defines` and `forcedInclude` variables combined with its own build steps but it is not limited to C/C++ builds.  
**Build++** runs [CppBuild](https://github.com/tdjastrzebski/cppbuild/) command line utility using tasks it creates 'on the fly'.

# How to use it?
1. Install command line [CppBuild](https://github.com/tdjastrzebski/cppbuild/) tool: `npm install cppbuild -g`
1. Go to menu **Terminal** and choose **Run Task...** option.  
You should see additional build tasks available.  
By default, build output files are placed in `./build` folder.
1. Modify created `c_cpp_build.json` file according to your needs.  
Detailed `c_cpp_build.json` file description is available at [CppBuild](https://github.com/tdjastrzebski/cppbuild/) GitHub site.

# Notes
1. Executing tasks **VS Code** uses current or default terminal. Therefore, using shell-specific commands in build steps make sure correct terminal shell is active or selected as default.
1. Build can be run from command line as well. Example: `cppbuild GCC debug`
1. If used with [vscode-cpptools](https://marketplace.visualstudio.com/items?itemName=ms-vscode.cpptools) `c_cpp_build.json`, file must contain configurations named exactly as those defined in `c_cpp_properties.json` file.
1. [CppBuild](https://github.com/tdjastrzebski/cppbuild/) is not limited to C/C++ builds and can be run without `c_cpp_properties.json` file. Use `-p` option with no file name, which requires [CppBuild](https://github.com/tdjastrzebski/cppbuild/) version 1.1.0 or later.
1. For more options use `cppbuild --help`.

# Syntax
1. Build step `command` is repeated for every file matching **filePattern** - if **filePattern** is specified.  
`${fileDirectory}`, `${filePath}` and `${fileName}` variables can be used in command.
1. In contrast, **fileList** defines `$${fileDirectory}`, `$${filePath}` and `$${fileName}` multi-valued variables, `command` is not repeated. 
1. **filePattern** and **fileList** are mutually exclusive and they use full [glob syntax](https://en.wikipedia.org/wiki/Glob_(programming)), e.g. exclusions can be specified.
1. Standard `${name}` variable syntax is used. `$${name}` denotes multi-valued variable. Environment variables `${env:name}` can be used as well.
1. `()` define sub-template. Sub-template can contain only one multi-valued variable.
1. Strings in `[]` are treated as paths and will be quoted if path contains whitespace. Path separators (\\ /) may be modified if needed.  
`[]` containing multi-valued variable is treated as sub-template as well.
1. Other variables available: **workspaceRoot**/**workspaceFolder**, **workspaceRootFolderName**, **outputDirectory**, **buildTypeName**, **configName**, **includePath**, **defines** and **forcedInclude**. The last three are populated from `c_cpp_properties.json` file.
1. Additional variables can be defined almost anywhere using `params` property. Variables defined on lower level take precedence.

# Predefined variables
The following variables have been predefined:
1. **workspaceRoot**/**workspaceFolder** (full folder path) and **workspaceRootFolderName** (just the folder name)
1. **configName** - selected build configuration name
1. **buildTypeName** - selected build type name (optional)
1. **filePath** (relative file path), **fileDirectory** (relative file directory), **fileName** (file name without extension), **fullFileName** (file name with extension), **fileExtension**  
The above variables are available when **filePattern** or **fileList** build step property is defined. When **filePattern** is defined, variables have single values and `command` is executed for every file matching the specified pattern. When **fileList** is defined, variables have multiple values but build step `command` is executed just once.
1. **includePath**, **defines** and **forcedInclude** - multi-valued variables populated from `c_cpp_properties.json` (if used)

# Why?
While working on C/C++ for embedded devices in VS Code I wanted to simplify multi-step build process configuration and maintenance. Also, I wanted to eliminate setting duplication (include paths and defines) between `c_cpp_properties.json` and widely used MAKE/CMake files.  
Although these tools are industry standard, I am not a big fan of them. All that led me to the development of a completely new build tool.  
Since [vscode-cpptools](https://marketplace.visualstudio.com/items?itemName=ms-vscode.cpptools) extension is popular and widely used, I adjusted to the status quo and used `c_cpp_properties.json` as it was, instead of supplying my own settings via [vscode-cpptools-api](https://github.com/Microsoft/vscode-cpptools-api).

# Improvements and fixes
Any improvements, fixes or suggestions are more than welcome. Use on GitHub:  
https://github.com/tdjastrzebski/cppbuild/  
https://github.com/tdjastrzebski/vscode-cppbuild

# Known issues
1. Although created tasks are marked as Build tasks, they do not appear in **Build Tasks** group. I suspect VS Code bug.
1. Occasionally output parts are not visible in Terminal window. The problem does not occur if **cppbuild** is run from the command prompt. The problem may be related to multi threading.
1. Defined **problemMatchers** do not seem to work. I suspect VS Code problem.