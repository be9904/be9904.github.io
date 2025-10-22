---
layout: post
title: Configuration of Neural Networks
date: Tue Oct 11 21:59:50 KST 2025
description: How to configure neural networks to solve a problem (SWE3052)
img: Deep-Learning-neural-network.png
fig-caption: # Add figcaption (optional)
# tags: [Artificial Intelligence, Neural Networks, Deep Neural Networks, Regression, Binary-Class Classification, Multi-Class Classification, Classification]
visibility: private
bmac: hide
---
# Contents
1. [Regression](#regression)
2. [Binary-Class Classification](#binary-class-classification)
3. [Multi-Class Classification](#multi-class-classification)
4. [References](#references)

In previous posts, we discussed the basics of neural networks and how to train one. In this post, we will talk about the 3 different types of prediction problems a neural network can handle and how to configure a neural network to solve them.

# Regression

**Regression** refers to predicting a *real value* for a given input. For example, given engine size, horsepower, vehicle weight and year of car, a regression problem predicts fuel efficiency(miles per gallon).

\$\$
\begin{bmatrix}
2.0 & 150 & 3000 & 2015 \\\\\\\\
2.4 & 180 & 3200 & 2016 \\\\\\\\
1.8 & 130 & 2800 & 2013 \\\\\\\\
3.0 & 200 & 3500 & 2017 \\\\\\\\
2.5 & 170 & 3300 & 2014 \\\\\\\\
1.6 & 110 & 2600 & 2012
\end{bmatrix}
\Rightarrow
\begin{bmatrix}
25.5 \\\\\\\\
24.0 \\\\\\\\
28.7 \\\\\\\\
22.2 \\\\\\\\
23.8 \\\\\\\\
30.1 
\end{bmatrix}
\$\$

But recall that we had an activation function for every neuron and we used a sigmoid function for each of them. The sigmoid function returns a real number between 0 and 1, which may not be as useful in many cases.

The solution would be to change the activation function of the output node into a linear function. This would remove the range of output from 0 to 1 into the range of the changed linear function. But since the weighted sum is also a linear representation of values from previous layers, it would be perfectly fine to just remove the output node's activation function.

<p align="center">
  <img src="/assets/img/2025-09-12-nnoverview/bias.jpg" width="60%" height="60%">
 </p>

Let \$y\$ be the output value of the neural network and \$y_1\$, \$y_2\$ be the output values of the hidden layer. Assuming bias exists, the weighted sum of the output node would be
\$\$
y = y_1w_1 + y_2w_2 + w_3
\$\$

The range of \$y_1\$ and \$y_2\$ is between 0 and 1 because it is the result of a sigmoid function and \$w_1\$, \$w_1\$ are both real numbers. Therefore, the weighted sum of the output node is a real number and the neural network will work fine without an activation function in the output node. We can also say that removing the activation function has the same effect as using a linear activation function.

If we interpret this mathematically, we can express the whole process in terms of matrices.
<p align="center">
  <img src="/assets/img/2025-10-11-configuration-of-neural-networks/regression.webp" width="70%" height="70%">
 </p>

Let the input layer have inputs \$x_i\$, hidden layer 1 have weighted sum \$s_i\$, return value \$h_i\$ and hidden layer 2 have weighted sum \$\sigma_i\$, return value \$H_i\$ and \$y\$ be the output value, where \$i\$ is the index of each node in a layer. We can express them as vectors, and with each step, the vector is being transformed into another vector.
\$\$
\begin{bmatrix} x_1 \\\\\\\\ x_2 \\\\\\\\ x_3 \end{bmatrix} \Rightarrow
\begin{bmatrix} s_1 \\\\\\\\ s_2 \\\\\\\\ s_3 \\\\\\\\ s_4 \end{bmatrix} \Rightarrow
\begin{bmatrix} h_1 \\\\\\\\ h_2 \\\\\\\\ h_3 \\\\\\\\ h_4 \end{bmatrix} \Rightarrow
\begin{bmatrix} \sigma_1 \\\\\\\\ \sigma_2 \\\\\\\\ \sigma_3 \\\\\\\\ \sigma_4 \end{bmatrix} \Rightarrow
\begin{bmatrix} H_1 \\\\\\\\ H_2 \\\\\\\\ H_3 \\\\\\\\ H_4 \end{bmatrix} \Rightarrow
...
\Rightarrow y
\$\$

Each step is a vector transformation, and where it is a simple weighted sum, we can express the transformation into a matrix.

\$\$
\begin{bmatrix} 
w_{11} & w_{12} & w_{13} & w_{14} \\\\\\\\
w_{21} & w_{22} & w_{23} & w_{24} \\\\\\\\
w_{31} & w_{32} & w_{33} & w_{34}
\end{bmatrix}^T
\begin{bmatrix} x_1 \\\\\\\\ x_2 \\\\\\\\ x_3 \end{bmatrix} =
\begin{bmatrix} s_1 \\\\\\\\ s_2 \\\\\\\\ s_3 \\\\\\\\ s_4 \end{bmatrix}
\$\$

# Binary-Class Classification

# Multi-Class Classification

# References

[Getting started with Neural Network for regression and Tensorflow](https://medium.com/@rajatgupta310198/getting-started-with-neural-network-for-regression-and-tensorflow-58ad3bd75223)