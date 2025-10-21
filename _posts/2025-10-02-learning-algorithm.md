---
layout: post
title: Learning Algorithm
date: Tue Oct 2 01:18:58 KST 2025
description: Error back propagation, gradient descent, activation functions and more...
img: Deep-Learning-neural-network.png
fig-caption: # Add figcaption (optional)
# tags: [Artificial Intelligence, Deep Neural Networks, Error Back Propagation, Gradient Descent, Overfitting]
visibility: private
bmac: hide
---
# Contents
1. [Introduction](#introduction)
2. [Learning with Gradient Descent](#learning-with-gradient-descent)
   - [Gradient Descent](#gradient-descent)
   - [Activation Function](#activation-function)
3. [Example of Error Back Propagation](#example-of-error-back-propagation)
4. [Generalization & Overfitting](<#generalization--overfitting>)
5. [References](#references)

# Introduction

Previously, we discussed how to design a simple neural network. We define a perceptron that computes the weighted sum of inputs and applies a threshold, then sends the resulting value to the next layer. But, we have no idea how to set weights for each connection. This section talks about finding the appropriate weight values with error back propagation.
<p align="center">
  <img src="/assets/img/2025-10-02-learning-algorithm/NN.jpg" width="60%" height="60%">
 </p>

# Learning with Gradient Descent

The basic idea of learning is to find weight values that produce outputs as close as possible to the given (target) outputs.
\\[ NN(w,x)\approx t\space\space\text{for all}\space (x,t) \\]
\\[ \Leftrightarrow 0 \approx \sum_{(x,t)\in data}\|t-NN(w,x)\| \\]
\\[ \Leftrightarrow 0 \approx \sum_{(x,t)\in data}(t-NN(w,x))^2 \\]
\\[ \Leftrightarrow E(w) = \sum_{(x,t)\in data}(t-NN(w,x))^2 \space\space\text{minimized}\\]
- \\(x\\): input
- \\(t\\): target output
- \\(NN\\): neural network to train
- \\(E\\): loss function

The mathematical problem we need to solve is this.
- Find weights \\(\textbf{w}=(w_1,w_2, ... ,w_n)\\) that minimize \\(E(w) = \sum_{(x,t)\in data}(t-NN(w,x))^2\\)

To solve this, we take the following steps.
1. Randomly initialize \\(w\\)
2. Find the gradient at the current position
3. Move down the loss function along with the gradient
4. Repeat until a local minimum is reached.

## Gradient Descent

In the steps above, **error back propagation** is used to compute gradients, and **gradient descent** is applied to update weights that minimize loss. Note that even though there is some other local minimum or a global minimum that is smaller, the process stops when any local minimum is reached and there is no way to verify whether there is a better minimum. Gradient descent can be mathematically written as follows.

\\[ w^{t+1} = w^t - \eta \frac{\partial E}{\partial w}\bigg\|_{w=w^t} \\]
- \\(\eta\\): learning rate
- \\(w^t\\): current position
- \\(\frac{\partial E}{\partial w}\bigg\|_{w=w^t}\\): gradient at current position

The gradient at the current position, multiplied by the learning rate (step size), is subtracted from the current weights, moving the point down the loss function. The learning rate doesn't need to change for each iteration because, as the weights approach a minimum, the gradient naturally decreases, automatically reducing step size and preventing oscillation. Here is a pseudocode for gradient descent.
```python
Random init w_0, w_1, ...
Repeat
    w_0 = w_0 - lr * dE/dw_0
    w_1 = w_1 - lr * dE/dw_1
    ...
Until stopping condition satisfied
```

To calculate gradients, we need to differentiate the loss function with respect to each weight. This can be done by getting the partial derivative of the loss function.
\\[ \frac{dE(w)}{dw_k} = \frac{d}{dw_k} \sum_{(x,t)\in Data}(t-NN(w,x))^2 = \sum_{(x,t)\in Data}\frac{d}{dw_k}(t-NN(w,x))^2 \\]

## Activation Function

Recall the cell body of a perceptron contains a linear weighted sum and an **activation function**. Since we are back propagating, we need to be able to get a gradient value from every part of the network. Using a hard limit like before would be pointless because it is not differentiable and all gradient values are 0 except for at the threshold. So we replace this with another activation called the **sigmoid** activation function.

<p align="center">
  <img src="/assets/img/2025-10-02-learning-algorithm/sigmoid.png" width="80%" height="80%">
 </p>
<p align="center"><b><i>Sigmoid Activation Function</i></b></p>

One notable property of the sigmoid function is that its derivative can be expressed in terms of the function itself.
\\[ \sigma(x) = \frac{1}{1 + e^{-x}} \\]
\\[ \frac{d}{dx}\sigma(x) = \sigma(x)(1-\sigma(x)) \\]
This makes gradient computations convenient in neural networks.

# Example of Error Back Propagation

Assume we create a neural network for a XOR logic classifier. Unlike previous simple problems, XOR logic is a non-linearly separable problem, so the network would look something like this.

<p align="center">
  <img src="/assets/img/2025-10-02-learning-algorithm/xor.png" width="50%" height="50%">
 </p>
<p align="center"><b><i>Sigmoid Activation Function</i></b></p>

We'll then randomly initialize weights like below.

| x_1 | x_2 | t | y |
| --- | --- | - | - |
| 1 | 1 | 0 |  0.52 |
| 1 | 0 | 1 |  0.50 |
| 0 | 1 | 1 |  0.52 |
| 0 | 0 | 0 |  0.55 |

<p align="center"><b><i>Iteration: 0</i></b></p>

As we keep updating weights, we can see the expected results getting somewhat close to the target output.

| x_1 | x_2 | t | y |
| --- | --- | - | - |
| 1 | 1 | 0 |  0.30 |
| 1 | 0 | 1 |  0.81 |
| 0 | 1 | 1 |  0.81 |
| 0 | 0 | 0 |  0.11 |

<p align="center"><b><i>Iteration: 3000</i></b></p>

| x_1 | x_2 | t | y |
| --- | --- | - | - |
| 1 | 1 | 0 |  0.02 |
| 1 | 0 | 1 |  0.98 |
| 0 | 1 | 1 |  0.98 |
| 0 | 0 | 0 |  0.02 |

<p align="center"><b><i>Iteration: 10000</i></b></p>

If we plot the error into a graph, it would look something like this.
<p align="center">
  <img src="/assets/img/2025-10-02-learning-algorithm/loss.webp" width="60%" height="60%">
 </p>
<p align="center"><b><i>Loss over time</i></b></p>

It would be a bad idea to set the stopping condition to when the loss is exactly 0 because

1. It would require almost an infinite number of epochs for loss to reach exactly 0.
2. Finding weights that have 0 loss for a single sample means it is likely to not perform well with other samples.

Therefore it is crucial to stop training at an appropriate point where the results are appropriate for a general dataset.

# Generalization & Overfitting

This brings us to generalization and overfitting. Depending on how we set the hyperparameters, the neural network may work well with samples that weren't used for training and may work well only for trained samples. The former is a neural network with good generalization while the latter is an overfitted neural network. A well trained neural network not only generalizes the dataset well, but also predicts unlearned values well. Our objective is to train a generalized neural network.

<p align="center">
  <img src="/assets/img/2025-10-02-learning-algorithm/underfitting_overfitting.png" width="100%" height="100%">
 </p>
<p align="center"><b><i>Underfitting, Generalization and Overfitting</i></b></p>

# References

[Mathematics behind the Neural Network](https://studymachinelearning.com/mathematics-behind-the-neural-network/)

[Sigmoid Function](https://www.geeksforgeeks.org/machine-learning/derivative-of-the-sigmoid-function/)

[Underfitting vs. Overfitting](https://scikit-learn.org/stable/auto_examples/model_selection/plot_underfitting_overfitting.html)