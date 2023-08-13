---
layout: post
title: Triplanar Mapping
date: 2023-08-13 16:36:16 +09:00
description: 
img: 2023-08-13-triplanar-mapping/cover.jpg
fig-caption: # Add figcaption (optional)
tags: [Unity, Shader Graph, Computer Graphics]
---

This post is based on the Unity tutorial **Triplanar Effect in Unity URP (Shader Graph Tutorial)** and uses the Boat Attack project by Unity Technologies. Check out [this post](https://be9904.github.io/cloning-a-project/) to setup the project.

## What is Triplanar Mapping?
Triplanar is a texture mapping technique used to eliminate distortion and stretching. The usual way to map textures is to pass the UV coordinates stored in a mesh to a shader and sample textures using those coordinates. However, in some cases, these UV coordinates can cause textures to look distorted, like the example below.

<p align="center">
  <img src="/assets/img/2023-08-13-triplanar-mapping/distorted-texture.jpeg" width="640" height="360">
 </p>
<p align="center"><b><i>Distorted Terrain Textures. WizardPie42 from Reddit.</i></b></p>

Triplanar mapping overcomes this limitation by using multiple 2D textures projected onto the surface along the X, Y and Z axes. The surface is divided into 3 different regions and each are textured using its corresponding 2D projection. For each point, the influence of the 3 mapped textures are calculated with blend weights. For example, if the surface normal is almost parallel to the Y axis, the sample from the Y-projected plane will blend in the most. This technique shows great results when rendering terrains, because distortion caused by complex surface geometry is mitigated and textures from different regions can be seamlessly blended.

<p align="center">
  <img src="/assets/img/2023-08-13-triplanar-mapping/tri-compare.jpg">
 </p>
<p align="center"><b><i>Comparison of UV Mapping (left) and Triplanar Mapping (right). Brent Owens.</i></b></p>

However, there are drawbacks to this technique. Since triplanar mapping blends 3 different textures, there may certain points or perspectives where the texture appears blurred. Also, since this technique uses world space coordinates instead of UVs, the tangents will not be correct, making the normal maps incorrect as well. Despite blending 3 textures, seams can be visible in certain occasions too, all of which results in loss of detail.

Performance is also an issue. It's not as efficient as traditional texture mapping since it maps the same texture 3 times. If there are more textures to sample like normal maps, specular maps, ambient occlusion maps etc; performance should be taken into account when using this technique in production.

## Triplanar Effect in Unity
Now let's take a look at how we can use the theories of triplanar mapping in Unity to create a shader that can dynamically adjust grass distribution on a cliff. There are two sets of textures for the cliff, a rock texture and a grass texture. If we sample the grass texture on the xz plane and lerp it with the rock texture, we can render grass on points of the cliff that faces up.

### Sampling Albedo
First, we will have to sample the albedo map of the rock and grass. To do that, create a **Sample Texture 2D** node and connect the albedo texture node. Do the same for the grass node and leave them for now. You can connect a **Preview** node to the output of the Sample Texture 2D node to check if it is sampled correctly.

<p align="center">
  <img src="/assets/img/2023-08-13-triplanar-mapping/triplanar-albedo.PNG" width="492" height="527">
 </p>
<p align="center"><b><i>Sampling Albedo Maps in Shader Graph</i></b></p>

### Sampling Normals
Next, we need to sample normals to give light variations. Grass normals can be sampled using the Sample Texture 2D node with the `Type` parameter set to `Normal`. However in this example, the rock normals are packed with the AO map like below. The AO map is stored in the R channel and the other channels store normals. Packing multiple textures to different channels of an image is efficient because it saves texture memory, but there are extra computations needed in the shader.

<p align="center">
  <img src="/assets/img/2023-08-13-triplanar-mapping/normal-ao.PNG" width="442" height="442">
 </p>
<p align="center"><b><i>Normal + AO</i></b></p>

To sample normals, extract the A, G, B channels to a Vector3 node and remap it from 0 ~ 1 to -1 ~ 1. You can remap it by either multiplying the Vector3 by 2 and subtracting by 1, or simply using the **Remap** node. Now, connect the R channel directly to **Ambient Occlusion** of the Fragment node and the remapped normal vector to **Normal** of the Fragment node.

<p align="center">
  <img src="/assets/img/2023-08-13-triplanar-mapping/triplanar-normal.PNG" width="447" height="440">
 </p>
<p align="center"><b><i>Sampling Rock and Grass Normals</i></b></p>

### Implementing Grass Height
Now that we finished sampling textures, we'll have to 

### Triplanar Effect

## References
[Triplanar Effect in Unity URP (Shader Graph Tutorial)](https://youtu.be/eZqd68YaY2U)