/** @type {import('next').NextConfig} */
const nextConfig = {
  // Load these packages with Node at run time instead of bundling them:
  // they include native code (the embedding model runtime and an image
  // library it depends on).
  serverExternalPackages: ['@huggingface/transformers', 'onnxruntime-node', 'sharp'],
  // Do not generate AGENTS.md in the project folder
  agentRules: false,
};

export default nextConfig;
