/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // O Prisma carrega o binário do query engine em runtime (não é import
    // estático), então o bundler não o enxerga sozinho — sem isto o build
    // passa e a função serverless quebra em produção com "could not locate
    // the Query Engine". O client é gerado em prisma/nutri/generated (ver
    // `output` no schema), fora do caminho que o Next rastreia por padrão.
    outputFileTracingIncludes: {
      "/**": ["./prisma/nutri/generated/**"],
    },
    // Prisma e o driver libSQL carregam binários nativos; mantê-los fora do
    // bundle do webpack faz o resolve do engine acontecer no runtime, com os
    // caminhos reais do pacote.
    serverComponentsExternalPackages: ["@prisma/client", "@prisma/adapter-libsql", "@libsql/client"],
  },
};

export default nextConfig;
