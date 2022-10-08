import { BinaryPoseidonTree } from "../src/utils/BinaryPoseidonTree";

const tree = new BinaryPoseidonTree();
tree.insert(5n);
console.log(tree.createProof(tree.count - 1));

// const circomlibjs = require("circomlibjs");
// console.log(circomlibjs);
