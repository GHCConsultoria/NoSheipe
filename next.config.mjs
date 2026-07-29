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

  // /nutri e /personal viraram a área única /pro quando Nutricionista e
  // PersonalTrainer viraram um Profissional só. Feito aqui, e não como
  // página que chama redirect(), porque uma página estática produz só um
  // meta-refresh no HTML — aqui sai um 308 de verdade, com Location, antes
  // de qualquer renderização.
  async redirects() {
    return [
      { source: "/nutri", destination: "/pro", permanent: true },
      { source: "/nutri/:caminho*", destination: "/pro/:caminho*", permanent: true },
      { source: "/personal", destination: "/pro", permanent: true },
      { source: "/personal/:caminho*", destination: "/pro/:caminho*", permanent: true },
    ];
  },
};

export default nextConfig;
