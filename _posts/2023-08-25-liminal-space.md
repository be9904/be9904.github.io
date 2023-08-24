---
layout: post
title: "[Project] Liminal Space - The Strange Vending Machine"
date: 2023-08-25 02:10:02 +09:00
description:
img: 2023-08-25-liminal-space/cover.png
fig-caption: # Add figcaption (optional)
tags: [Project, Unity, Blender, Shaders, Animation]
bmac: show
---

_'Liminal Space - The Strange Vending Machine'_ is a team project I worked on at XREAL. The main tools used for this project were Unity and Blender.

<p align="center">
  <img src="/assets/img/2023-08-25-liminal-space/intro.png" width="70%" height="70%">
</p>

My job was modeling, rigging, and animating a coin character, which was the protagonist of our fictional universe, implementing toon style shading, creating cut scenes using Unity's Cinemachine, and overall project management with Git.

The goal of this project was to understand DCC tools and get a grasp of artist workflows.

### Story

This short film is about a coin that wishes to become special and unique. He believes that by entering a vending machine, he can transform into something special, like a fancy toy, Lego character, or a teddy bear. So, he finds his way into the vending machine and discovers the parts of what he wants to become scattered on a huge island.

The coin retrieves parts of the shoe and expects to finally transform from his worthless, unattractive self but realizes that he was only used by the vending machine to create the final product. Full of despair, the coin searches for another way out but discovers countless other coins being carried away in a deadly coin river, all of which have failed to escape.

The film ends by showing the coin jumping off the exit, trying to make his way out of the vending machine.

### Character

**1. Modeling**

This is the final model of the coin character. The hands were made by creating a hand skeleton with a skin modifier. I cleaned up the topology using the remesh modifier. Arms, legs and shoes were sculpted from scratch. The face was replaced with an array of facial expression textures. I used <a href="https://southernshotty.gumroad.com/l/fmarts/7xxsskp" target="_blank">SouthernShotty's Face Animation Files</a>. These textures are amazing and royalty free, I recommend checking out his other assets, too.

<p align="center">
  <img src="/assets/img/2023-08-25-liminal-space/model.png" width="60%" height="60%">
 </p>
<p align="center"><b><i>Coin Model</i></b></p>

**2. Rigging**

I initially attempted to rig the character using Mixamo's auto rigger. However, since Mixamo's auto rigger is for humanoid characters, applying animations caused the coin's body to distort. To fix this issue, I imported the character in a T-pose into Blender, removed unnecessary bones and made minor adjustments to bone weights.

<p align="center">
  <img src="/assets/img/2023-08-25-liminal-space/rig.png" width="60%" height="60%">
 </p>
<p align="center"><b><i>Coin Skeleton</i></b></p>

**3. Animating**

Because there were no skeletons identical or even similar to this coin character, I manually adjusted each animation frame by frame. At the time, I had limited knowledge of character animation, so this task was quite tedious. However, I later realized that this process can be simplified by retargeting a humanoid skeleton to this custom one and exporting animations from the retargeted skeleton. Here's what the animations look like.

<p align="center">
  <img src="/assets/img/2023-08-25-liminal-space/walk.png" width="60%" height="60%">
 </p>
<p align="center"><b><i>Walking</i></b></p>

<p align="center">
  <img src="/assets/img/2023-08-25-liminal-space/carry.png" width="60%" height="60%">
 </p>
<p align="center"><b><i>Running with a Box</i></b></p>

### Toon Shading

In the planning phase, our team decided that a toon style would better suit our fictional universe than making everything look photorealistic. We achieved this effect by using Unity's toon shader package, which was applied to the coin character and every item in the vending machine. As a result, the toon style along with the outline effect helped emphasize crucial elements of our universe.

<p align="center">
  <img src="/assets/img/2023-08-25-liminal-space/toon.png" width="70%" height="70%">
 </p>
<p align="center"><b><i>Toon Shading</i></b></p>

Outside the vending machine, the background is black and white, while the vending machine itself is portrayed with bright colors, emphasizing its presence in the world. This toon style, combined with the dark, dystopian mood, effectively conveys our intention of a 'strange vending machine'.

<p align="center">
  <img src="/assets/img/2023-08-25-liminal-space/vending.png" width="70%" height="70%">
 </p>
<p align="center"><b><i>The Strange Vending Machine</i></b></p>

The inside of the vending machine contrasts with the outside. It presents a brighter, more colorful world, unlike the colorless exterior. This contrast creates a different form of mystery, instilling the coin with hope, believing it's a place where his dreams can come true.

<p align="center">
  <img src="/assets/img/2023-08-25-liminal-space/island.png" width="70%" height="70%">
 </p>
<p align="center"><b><i>The Item Island</i></b></p>

As a result, toon style shading effectively showed the core elements and atmosphere of the scene.

### Cinemachine

I used Unity's Cinemachine to create cutscenes of the final film. The package was straightforward and easy to use. There were a variety of components and parameters provided for camera movement. I used virtual cameras with dolly tracks to simulate camera movement like panning, dolly zoom, arc shots etc.

<p align="center">
  <img src="/assets/img/2023-08-25-liminal-space/timeline.png" width="70%" height="70%">
 </p>
<p align="center"><b><i>Using Cinemachine and Timeline in Unity to create a sequence</i></b></p>

### Wrapping Up

Since this project was one of my earliest works, there were many areas for improvement. I learned how to effectively communicate with artists and provide them with the necessary tools and solutions to achieve specific production goals. Here is the final video of the project.

<div class="video-container">
    <iframe src="https://www.youtube.com/embed/J32Xixkvhqc" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div>
