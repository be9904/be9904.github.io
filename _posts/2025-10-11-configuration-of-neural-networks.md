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

# Binary-Class Classification

# Multi-Class Classification

# References