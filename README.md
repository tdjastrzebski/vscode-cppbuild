# What is it?
* **Build++** is **VS Code** multi-step incremental build tool extension based on JSON, string templates and [glob syntax](https://en.wikipedia.org/wiki/Glob_(programming)).  
* **Build++** can build C/C++ projects using [vscode-cpptools](https://marketplace.visualstudio.com/items?itemName=ms-vscode.cpptools) `includePath`, `defines` and `forcedInclude` variables combined with its own build steps but it is not limited to C/C++ builds.  
* **Build++** runs [cppbuild](https://github.com/tdjastrzebski/cppbuild/) command line utility using tasks it creates 'on the fly'.

# How to use it?
1. Install command line **cppbuild** tool: `npm install cppbuild -g`
1. Modify created `c_cpp_build.json` file according to your needs.  
1. Go to menu **Terminal** and choose **Run Task...** option.  
You should see additional build tasks available.  
1. Build can be run from terminal window as well:  
`cppbuild <config name> [build type] -w`  
e.g. `cppbuild gcc debug -w`  
`-w` switch with no path tells **cppbuild** to use the current VS Code workspace.  
Add `-d` switch to output executed commands, `-c` switch to continue on errors or `-f` switch to force rebuild of all files.  

Run `cppbuild --help` for more options.  

# The idea
Sample build type:
```yaml
{
  "name": "debug",
  "params": { "buildTypeParams": "-O0 -g" }
}
```

Sample build step:
```yaml
{
  "name": "C++ Compile",
  "filePattern": "**/*.cpp",
  "outputFile": "build/${buildTypeName}/${fileDirectory}/${fileName}.o",
  "command": "g++ -c ${buildTypeParams} (-I[$${includePath}]) (-D$${defines}) [${filePath}] -o [${outputFile}]"
}
```
Here is how it works:
1. **command** (here g++ compiler) is run for every file matching **filePattern** (**/*.cpp).
1. `(-I[$${includePath}])` and `(-D$${defines})` define sub-templates repeated for every **includePath** and **defines** value listed in corresponding configuration from **c_cpp_properties.json** file.
1. `${fileName}`, `${filePath}` and `${fileDirectory}` are substituted by the name, path and relative directory of the file being processed.
1. `${outputFile}` value is built as defined by **outputFile** template. Note that **outputFile** can be build using relative path of the file being processed. As a result, inside the output **build** folder directory structure will resemble the input directory structure. Required directory will be created if it does not exists.
1. `${buildTypeParams}` is defined in **build type** section. For DEBUG build type `-O0 -g` switches will be added.
1. Strings in `[]` are treated as file paths and will be quoted if path contains whitespace. Path separators may be modified depending on the OS.
1. Be default, if **outputFile** already exists and is more recent than the processed input file, build for this file will not be performed. As a result, only modified files will be built (incremental build).

# Build file syntax
1. Build step `command` is repeated for every file matching **filePattern** - if **filePattern** is specified.  
`${fileDirectory}`, `${filePath}` and `${fileName}` variables can be used in command.
1. In contrast, **fileList** defines `$${fileDirectory}`, `$${filePath}` and `$${fileName}` multi-valued variables, `command` is not repeated. 
1. **filePattern** and **fileList** are mutually exclusive and they use full **glob syntax**, e.g. exclusions can be specified.
1. Standard `${name}` variable syntax is used. `$${name}` denotes multi-valued variable. Environment variables `${env:name}` can be used as well.
1. `()` define sub-template. Sub-template can contain only one multi-valued variable.
1. Strings in `[]` are treated as paths and will be quoted if path contains whitespace. Path separators (\\ /) may be modified if needed.  
`[]` containing multi-valued variable is treated as sub-template as well.
1. Other variables available: **workspaceRoot**/**workspaceFolder**, **workspaceRootFolderName**, **outputDirectory**, **buildTypeName**, **configName**, **includePath**, **defines** and **forcedInclude**. The last three are populated from `c_cpp_properties.json` file.
1. Additional variables can be defined almost anywhere using `params` property. Variables defined on lower level take precedence.
1. Variable values and **outputFile**/**outputDirectory** properties can contain other variables. Example: **outputFile**/**outputDirectory** variable can contain `${fileDirectory}`. As a result, inside the output **build** folder directory structure will resemble the input directory structure.
1. Be default, if **outputFile** already exists and is more recent than the processed input file, build for this file will not be performed. As a result, only modified files will be built (incremental build).

# Predefined variables
The following variables have been predefined:
1. **workspaceRoot**/**workspaceFolder** (full folder path) and **workspaceRootFolderName** (just the folder name)
1. **configName** - selected build configuration name
1. **buildTypeName** - selected build type name (optional)
1. **filePath** (relative file path), **fileDirectory** (relative file directory), **fileName** (file name without extension), **fullFileName** (file name with extension), **fileExtension** (without .)  
The above variables are available when **filePattern** or **fileList** build step property is defined. When **filePattern** is defined, variables have single values and `command` is executed for every file matching the specified pattern. When **fileList** is defined, variables have multiple values but build step `command` is executed just once.
1. **outputDirectory** - output directory, available when build step **outputDirectory** template is specified
1. **includePath**, **defines** and **forcedInclude** - multi-valued variables populated from `c_cpp_properties.json` (if used)
1. **outputFile** - available only when **filePattern** is specified.

# Notes
1. Executing tasks **VS Code** uses current or default terminal. Therefore, using shell-specific commands in build steps make sure correct terminal shell is active or selected as default.
1. Build can be run from command line as well. Example: `cppbuild GCC debug`
1. If used with **vscode-cpptools** `c_cpp_build.json`, file must contain configurations named exactly as those defined in `c_cpp_properties.json` file.
1. **cppbuild** is not limited to C/C++ builds and can be run without `c_cpp_properties.json` file. Use `-p` option with no file name, which requires **cppbuild** version 1.1.0 or later.
1. For more options use `cppbuild --help`.

# Why?
While working on C/C++ for embedded devices in VS Code I wanted to simplify multi-step build process configuration and maintenance. Also, I wanted to eliminate setting duplication (include paths and defines) between `c_cpp_properties.json` and widely used MAKE/CMake files.  
Although these tools are industry standard, I am not a big fan of them. All that led me to the development of a completely new build tool.  
Since **vscode-cpptools** extension is popular and widely used, I adjusted to the status quo and used `c_cpp_properties.json` as it was, instead of supplying my own settings via [vscode-cpptools-api](https://github.com/Microsoft/vscode-cpptools-api).

# Improvements and fixes
Any improvements, fixes or suggestions are more than welcome on GitHub:  
https://github.com/tdjastrzebski/cppbuild/  
https://github.com/tdjastrzebski/vscode-cppbuild

# Known issues
1. Although created tasks are marked as Build tasks, they do not appear in **Build Tasks** group. It is not clear whether this is a bug or not.  
For details refer to [VS Code issue \#83378](https://github.com/microsoft/vscode/issues/83378#issuecomment-548838702).

# Release notes
* 1.0 Initial release
* 1.1 `params` can be added on all levels, tool can work without C/C++ extension and `c_cpp_properties.json` file.
* 1.2 Added support for incremental builds and `outputFile` build step property.
* 1.3 **cppbuild** updated to significantly improved [version 1.3.0](https://github.com/tdjastrzebski/cppbuild#release-notes).
* 1.3.13 `Tasks unexpectedly provided a task of type "shell"` fix.
* 1.3.16 cppbuild updated to improved version 1.3.16.
* 1.3.17 lodash updated to ver 4.17.20 to eliminate known vulnerabilities
