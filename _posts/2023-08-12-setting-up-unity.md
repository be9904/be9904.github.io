---
layout: post
title: Getting Started with Unity
date: 2023-08-12 07:27:59 +09:00
description: First look at Unity
img: 2023-08-12-setting-up-unity/unity-logo.jpg
fig-caption: # none
tags: [Unity]
---
  
Back in 2005 when Unity was first released, it was mostly used for 2D, mobile games. Today, it is used in a variety of different platforms, including 3D games, film production and XR. This post will go through the process of 
how to install and setup Unity and necessary plugins and packages.

## Unity Hub
Unity Hub is an application that helps manage projects and licenses, download new versions of the editor and provide templates to start with. [Here](https://unity.com/download) is a link to download Unity Hub. Although you can install versions 
of Unity directly with Unity installers, but it is recommended to download it through Unity Hub because it can be easily managed through the hub. Below is a screenshot of Unity Hub showing all editor versions installed.

![Unity Installs]({{site.baseurl}}/assets/img/2023-08-12-setting-up-unity/hub-installs.png)

After downloading the Unity Hub installer, run the installer. Once the download has finished, run Unity Hub to open it. You will need an account to start with, and you can make one [here](https://id.unity.com/). Your Unity account will store 
information about active licenses and purchased packages from the [Unity Asset Store](https://assetstore.unity.com/). Sign in with your account and enable a free personal license to start with.

## Installing an Editor
Unity provides a ton of different editors with different versions. You will have to check engine patch notes to check if necessary packages are supported in specific editor versions. LTS versions are stable releases, so if you are not planning 
to upgrade or downgrade Unity, it is recommended to use LTS. Currently, 2022 LTS is the most recent stable release. Unity Editor versions can be found in the installs tab on the left sidebar of Unity Hub. Click on Install Editor on the top right 
corner and choose the desired version. If you can't find the version you're looking for, click on Archive and visit download archive to find all versions of the Unity editor.

![Unity Archive]({{site.baseurl}}/assets/img/2023-08-12-setting-up-unity/hub-archive.png)

Now select modules you need to build your projects to certain platforms. I am working on VR projects, so in my case, I will need Android Build Support. Agree to terms and conditions and the download will start.

![Modules]({{site.baseurl}}/assets/img/2023-08-12-setting-up-unity/hub-modules.png)

![Unity Download]({{site.baseurl}}/assets/img/2023-08-12-setting-up-unity/hub-download.png)

## Creating a New Project
Now to create a project, go to the Projects tab on the left sidebar and click New Project on the top right corner. At the top of the window, make sure editor version is set correctly and choose a template to start with.

![New Project]({{site.baseurl}}/assets/img/2023-08-12-setting-up-unity/hub-newproj.png)

Assets and packages will be downloaded from the Unity registry while the editor loads. You can see the list of packages in `packages-lock.json` in the Packages folder of the project. After the editor loads, you can start working on your project 
through the editor and a code editor of your preference.

![Unity Editor]({{site.baseurl}}/assets/img/2023-08-12-setting-up-unity/unity-main.png)

Creating games is not just about programming. You need an overall understanding of how the engine works and how packages and plugins are managed. You will also need to understand how to use certain assets like 3D models, animation clips and textures 
if you are trying to add custom artwork to your game. With all this together in a single game engine, you can create countless games with different gameplay and art styles.