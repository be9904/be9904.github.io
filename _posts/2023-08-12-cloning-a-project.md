---
layout: post
title: Cloning a Project
date: 2023-08-12 17:44:45 +09:00
description: How to download and open an open source project from GitHub
img: 2023-08-12-cloning-a-project/cover.jpg
fig-caption: # Add figcaption (optional)
tags: [Unity, GitHub]
---

There are countless open source Unity projects on GitHub and many of them are very high quality. Cloning these projects and looking at what other people have done is also a great way to learn. In this post, I will explain how to clone a project 
from GitHub and open it in your computer. In this example, I will be cloning [Boat Attack](https://github.com/Unity-Technologies/BoatAttack), a URP sample project created by Unity Technologies.

### Step 1. Find your project on GitHub
First you will need to find your project on GitHub. You can either google it, or search it directly in GitHub. Another useful way is to search by tag. After finding the repository, copy the project link.

![Copy Link]({{site.baseurl}}/assets/img/2023-08-12-cloning-a-project/copy-link.png)

### Step 2. Clone Repository using GitHub Desktop
Now we will clone the repository to the local computer. This can be done through Git Bash with some commands, but to make things easier, I will do this in [GitHub Desktop](https://desktop.github.com/). Install GitHub Desktop if you don't have it and navigate to **Clone Repository** (File > Clone Repository).

![Clone Repo]({{site.baseurl}}/assets/img/2023-08-12-cloning-a-project/clone.png)

Choose clone repository with **URL** and paste in the repository link copied from github. Navigate to where you want to save the repository below in local path and click clone.

![URL]({{site.baseurl}}/assets/img/2023-08-12-cloning-a-project/url.png)

Some projects contain assets like videos, audio and large images. GitHub Desktop will ask to initialize Git LFS in those cases, so click Initialize Git LFS.

![LFS]({{site.baseurl}}/assets/img/2023-08-12-cloning-a-project/lfs.png)

### Step 3. Add Project to Unity Hub
Now that the download is complete, we will add the cloned project to Unity Hub so we can choose which version to open it in. Open Unity Hub and add the project by clicking the dropdown arrow next to **Open > Add project from disk**. Navigate to where you saved the project, which is the path you entered in **Local Path** in step 2.

![Add Project]({{site.baseurl}}/assets/img/2023-08-12-cloning-a-project/add-proj.png)

The project should pop up at the top of the list. However, the author of the cloned project might not be using the same Unity version as you. In this case, you must check the original repository README or any other documentation to see if there are versions that do not work. If there are no mentions of the engine version, the project will generally be compatible with various versions. In this case, the master branch was made in Unity 2020.3.23f1. However, as the 2020 versions are a bit outdated at this point, I'll update it to 2021.3.2f1, which is an LTS release. This can be done by selecting the preferred editor version in the editor version toggle. If you need to install an editor, check out [this post](https://be9904.github.io/setting-up-unity/).

![Editor Version]({{site.baseurl}}/assets/img/2023-08-12-cloning-a-project/hub-list.png)

![Change Version]({{site.baseurl}}/assets/img/2023-08-12-cloning-a-project/version-chng.png)

![Version Warning]({{site.baseurl}}/assets/img/2023-08-12-cloning-a-project/version-warning.png)

### Step 4. Import Necessary Packages and Fix Compile Errors
Changing the editor version will show a bunch of errors. Follow the steps like below and **enter safe mode** to fix the errors.

![Error 1]({{site.baseurl}}/assets/img/2023-08-12-cloning-a-project/error1.png)
![Error 2]({{site.baseurl}}/assets/img/2023-08-12-cloning-a-project/error2.png)
![Error 3]({{site.baseurl}}/assets/img/2023-08-12-cloning-a-project/error3.png)

The safe mode error may not appear if there are no compile errors after changing the version. In this case, we can see that there are errors with Cinemachine. The error messages show that the Cinemachine namespace is missing, which would mean that either the package is corrupt or missing. To fix this, navigate to the **Package Manager** window and update or reinstall Cinemachine.

![Log Error]({{site.baseurl}}/assets/img/2023-08-12-cloning-a-project/cinemachine-error.png)

![Locate Package Manager]({{site.baseurl}}/assets/img/2023-08-12-cloning-a-project/pkg-toolbar.png)

![Update Package]({{site.baseurl}}/assets/img/2023-08-12-cloning-a-project/pkg-window.png)

### Step 5. Commit Changes
After fixing the errors, Unity should recompile and you should see something like this.

![Boat Attack]({{site.baseurl}}/assets/img/2023-08-12-cloning-a-project/final.png)

Finally, commit the changes made to the project. To save further changes and modify the project for your own purposes, I recommend **forking** the repository and committing changes in the forked repository.

![Commit]({{site.baseurl}}/assets/img/2023-08-12-cloning-a-project/commit.png)