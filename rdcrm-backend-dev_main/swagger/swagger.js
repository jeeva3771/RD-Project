import swaggerJsDoc from "swagger-jsdoc";

const options = {
	definition: {
		openapi: "3.0.0",
		info: {
			title: "RD API",
			version: "1.0.0",
			description: "API documentation for RDCRM project",
		},
		components: {
			securitySchemes: {
				bearerAuth: {
					type: "http",
					scheme: "bearer",
					bearerFormat: "JWT",
				},
			},
		},
		security: [
			{
				bearerAuth: [],
			},
		],
		servers: [
			{
				url: "http://localhost:8888",
				description: "Local Server",
			},
		],
	},

	// Path to the API docs (controllers or routes)
	apis: ["./routes/index.js", "./routes/**/*.js"],
};

const swaggerSpec = swaggerJsDoc(options);

// Swagger UI options with filter enabled
const swaggerUiOptions = {
  swaggerOptions: {
    filter: true, // Enable tag filtering/search
    displayRequestDuration: true,
    docExpansion: 'none', // 'none' | 'list' | 'full'
    defaultModelsExpandDepth: 1,
    defaultModelExpandDepth: 1,
    deepLinking: true,
    displayOperationId: false,
    tagsSorter: 'alpha', // Sort tags alphabetically
    operationsSorter: 'alpha', // Sort operations alphabetically
    tryItOutEnabled: true,
    persistAuthorization: true, // Persist authorization data
  },
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info { margin: 20px 0 }
  `,
  customSiteTitle: 'API Documentation',
};

export {swaggerSpec, swaggerUiOptions};
