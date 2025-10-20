---
layout: post
title: Overview of Neural Networks
date: Mon Oct 20 02:35:27 KST 2025
description: Overview of deep neural networks covered in Introduction to Deep Neural Networks (SWE3052)
img: Deep-Learning-neural-network.png
fig-caption: # Add figcaption (optional)
# tags: [Artificial Intelligence, Deep Neural Networks]
visibility: private
bmac: hide
---
# Contents
1. [Introduction](#introduction)
2. [Mathematical Model](#mathematical-model)
3. [Neural Networks](#neural-networks)
4. [References](#references)

# Introduction

A neural network is a machine learning model that stacks perceptrons in layers and its structure is inspired by the human brain. The human brain has countless neurons connected into a network, each sending signals to other neurons. While a neural network also aims to follow this structure, it consists of layers with several perceptrons in each layer. This structural choice is due to simplicity in implementation. 
<p align="center">
  <img src="/assets/img/2025-10-20-nnoverview/Kelly_Neural_network.jpg" width="80%" height="80%">
 </p>
<p align="center"><b><i>The Human Brain's Neural Network</i></b></p>

Each artificial neuron (aka perceptron) in the layers is functionally similar to an actual neuron. An artificial neuron has an input gate and output gate, which corresponds to dendrite and axon terminal respectively. The human brain alters connection strength between each neuron instead of creating a new brain cell to store new information. Artificial neural networks follow this process and update weights, which is one of the core processes of training a deep neural network.
<p align="center">
  <img src="/assets/img/2025-10-20-nnoverview/neuron.webp" width="80%" height="80%">
 </p>
<p align="center"><b><i>Structure of a Neuron</i></b></p>

# Mathematical Model

Neurons can be represented mathematically as follows.
<p align="center">
  <img src="/assets/img/2025-10-20-nnoverview/artificial_neuron.webp" width="80%" height="80%">
 </p>
<p align="center"><b><i>Mathematical Representation of a Neuron</i></b></p>
- \\(x_i\\): input (dendrites)
- \\(w_i\\): connection strength/weight (amount of receptors in each dendrite)
- \\(b\\): bias
- \\(z\\) & \\(f\\): cell body
- \\(y\\): output (axon)

Each input has its own connection weight, and stronger connection strength means more signals can be sent to the next neuron.

# Neural Networks

# References

[What Is a Neural Network?](https://www.ibm.com/think/topics/neural-networks#741977106)

[The Concept of Artificial Neurons (Perceptrons) in Neural Networks](https://towardsdatascience.com/the-concept-of-artificial-neurons-perceptrons-in-neural-networks-fab22249cbfc/)