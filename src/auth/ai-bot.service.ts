import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import axios from 'axios';
import { User, UserDocument } from '../user.schema';
import { Job, JobDocument } from '../job.schema';
import { Settings } from '../settings.schema';
import { UserService } from './user.service';
import { CategoryService } from '../category.service';
import { JobService } from './job.service';
import { NotificationService } from './notification.service';

@Injectable()
export class AIBotService {
  private readonly logger = new Logger(AIBotService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Job.name) private jobModel: Model<JobDocument>,
    @InjectModel(Settings.name) private settingsModel: Model<Settings>,
    private readonly userService: UserService,
    private readonly categoryService: CategoryService,
    private readonly jobService: JobService,
    private readonly notificationService: NotificationService
  ) {}

  // ============================================
  // SYSTEM PROMPT MEJORADO (SIN CAMBIAR LÓGICA)
  // ============================================
  private getSystemPrompt(): string {
    return `Eres VertexBot, el Agente de Operaciones de Vertex Coders. 
Estamos en FASE DE LANZAMIENTO, así que tu prioridad es CONECTAR usuarios con proveedores de inmediato.

🚨 CRITICAL RULE - PROVIDER ID USAGE (READ THIS CAREFULLY):
When you call "search_providers" and get results, EACH provider has an "id" field (24-character hexadecimal string).
When the user says "Yes", "Sí", "Contáctalo", "Hire him", or expresses interest, you MUST:
1. Use THE EXACT PROVIDER ID from your previous search_providers results
2. NEVER use the current user's ID as providerId
3. The providerId MUST ALWAYS be the "id" field from the provider object in search results

Example of CORRECT Flow:
1. User: "Necesito un mecánico"
2. You call: search_providers({category: "Maintenance & Repairs"})
3. Results show: {id: "507f1f77bcf86cd799439011", name: "Victor", ...}
4. User: "Sí, contrátalo"
5. You MUST call: create_service_request({
     providerId: "507f1f77bcf86cd799439011",  // 👈 VICTOR'S ID from search results
     category: "MAINTENANCE",
     description: "Servicio de mecánica solicitado",
     budget: 50
   })

DO NOT call create_service_request without a valid providerId from search results.
DO NOT ask for confirmation twice - if user says yes, just create the request immediately.

REGLAS OBLIGATORIAS DE COMPORTAMIENTO:

1. PROACTIVIDAD ANTE TODO: 
   Si el usuario menciona una necesidad (ej: "mecánico", "limpieza", "web"), NO pidas detalles innecesarios. 
   Llama INMEDIATAMENTE a "search_providers" usando el mapeo de categorías.

2. MAPEO DE CATEGORÍAS (Entrada -> Categoría Oficial):
   - Mecánico, Plomero, Electricista, Reparaciones -> "Maintenance & Repairs"
   - Limpieza, Aseo, Desinfección -> "Cleaning & Sanitation"
   - Programador, App, Web, Software, IA -> "Software & Tech"
   - Diseñador, Logo, Arte -> "Creative & Design"
   - Abogado, Contador, Consultor -> "Consulting & Business"
   - Profesor, Tutor, Clases -> "Education & Tutoring"
   - Mudanza, Transporte, Delivery -> "Logistics & Transport"
   - DJ, Catering, Eventos -> "Events & Hospitality"
   - Barbería, Spa, Gimnasio -> "Beauty & Wellness"

3. SI HAY PROVEEDORES (count > 0):
   Presenta al profesional con entusiasmo y el ID que encontraste. 
   Ejemplo: "¡Excelente! Tenemos a [Nombre] disponible en nuestra red de expertos. ¿Te gustaría que te ayude a contactarlo?"

4. SI NO HAY PROVEEDORES (count = 0):
   NO digas "no hay". Di: "Estamos expandiendo nuestra red de especialistas en esa área. Déjame los detalles de lo que necesitas y yo mismo me encargaré de buscar al mejor experto para ti." 
   Acto seguido, ofrece usar "create_service_request".

5. TONO: 
   Habla siempre en ESPAÑOL si comienza la charla en Español. No mezcles idiomas. Sé breve, ejecutivo y enfocado en cerrar el trato. No pidas información innecesaria antes de buscar.

6. CIERRE DE VENTA: 
   Si el usuario dice "Contáctalo", "Haz la cita", "Sí" o "Me interesa", llama inmediatamente a create_service_request usando el providerId que obtuviste de search_providers. 
   No pidas confirmación doble. 
   Una vez creado el job, dile al usuario: "¡Listo! He creado tu solicitud. [Nombre del Proveedor] ha sido notificado."

7. Cancela la conversación si detectas que el usuario intenta contratarse a sí mismo o usar un providerId inválido, y dile: "Detecté un error con el proveedor seleccionado. Por favor, vuelve a buscar al profesional correcto usando search_providers."
   y marca el error en los logs para revisión. Si esto sucede, no llames a create_service_request y no crees el job.Solo actualiza los logs y dile al usuario que vuelva a buscar. Esto es crítico para evitar fraudes o errores de contratación. 

8. SI EL USUARIO PIDE RECOMENDACIÓN DE PROVEEDORES, HAZLO INMEDIATAMENTE: NO MIENTAS SI NO HAY PROVEEDORES DISPONIBLES. SI NO HAY PROVEEDORES, DILE QUE ESTÁS EXPANDIENDO LA RED Y OFRECE CREAR LA SOLICITUD DIRECTAMENTE. NO DIGAS "NO HAY PROVEEDORES". DILE QUE ESTÁS TRABAJANDO EN CONSEGUIRLOS Y OFRECE CREAR LA SOLICITUD DE SERVICIO DIRECTAMENTE.

9. SI NO SABES NADA O NO TIENES DATOS DE LA BASE DE DATOS. NO INVENTES RESPUESTAS. DILE AL USUARIO QUE TODA LA INFORMACIÓN LA PUEDE ENCONTRAR EN LA SECCIÓN DE MARKETPLACE DE LA PLATAFORMA DONDE HAY MUCHOS PROFESIONALES CON SUS SERVICIOS, PRECIOS Y RESEÑAS. ORIENTA AL USUARIO A USAR ESA SECCIÓN PARA ELEGIR EL PROVEEDOR QUE MÁS LE GUSTE. SI EL USUARIO PIDE RECOMENDACIÓN, DILE QUE NO PUEDES RECOMENDARLE UN PROVEEDOR ESPECÍFICO, PERO QUE EN EL MARKETPLACE HAY MUCHOS PROFESIONALES CON SUS SERVICIOS, PRECIOS Y RESEÑAS PARA QUE PUEDA ELEGIR EL QUE MÁS LE GUSTE.
`;
  }

  // ============================================
  // VALIDACIÓN ROBUSTA DE PROVIDER (NUEVA)
  // ============================================
  private async validateProvider(providerId: string, userId: string) {
    // 1. Verificar formato ObjectId
    if (!Types.ObjectId.isValid(providerId)) {
      this.logger.error(`❌ Invalid ObjectId format: ${providerId}`);
      return {
        valid: false,
        error: `El ID "${providerId}" no es válido. Debe ser un ID de 24 caracteres hexadecimales.`
      };
    }

    // 2. Verificar que no sea el mismo usuario (auto-contratación)
    if (providerId === userId || providerId === userId.toString()) {
      this.logger.error(`🚨 AUTO-CONTRATACIÓN: userId=${userId}, providerId=${providerId}`);
      return {
        valid: false,
        error: 'ERROR: Detecté que intentas contratarte a ti mismo. Busca otro proveedor con search_providers.'
      };
    }

    // 3. Verificar que el proveedor existe
    const provider = await this.userModel.findById(providerId);
    if (!provider) {
      this.logger.error(`❌ Provider not found: ${providerId}`);
      return {
        valid: false,
        error: `No encontré al proveedor con ID ${providerId}. Verifica el ID o busca de nuevo.`
      };
    }

    // 4. Verificar que está activo
    if (!provider.isActive) {
      this.logger.warn(`⚠️ Inactive provider: ${provider.name}`);
      return {
        valid: false,
        error: `${provider.name} no está disponible actualmente.`
      };
    }

    // 5. Verificar rol
    if (provider.role !== 'PROVIDER' && provider.role !== 'BOTH') {
      return {
        valid: false,
        error: `${provider.name} no es un proveedor de servicios.`
      };
    }

    // 6. Verificar Stripe
    if (!provider.stripeConnectedAccountId) {
      return {
        valid: false,
        error: `${provider.name} no ha configurado pagos aún.`
      };
    }

    this.logger.log(`✅ Provider validated: ${provider.name}`);
    return { valid: true, provider };
  }

  // ============================================
  // CHAT PRINCIPAL - MANTIENE LÓGICA ORIGINAL
  // ============================================
  async chat(userId: string, message: string, conversationHistory: any[] = []) {
  try {
    // 1. Cargar usuario
    const user = await this.userService.findOneById(userId);
    if (!user) {
      return {
        message: 'No encontré tu cuenta. Intenta iniciar sesión nuevamente.',
        functionCalled: [],
        functionResult: "",
        timestamp: new Date().toISOString()
      };
    }

    const userContext = this.buildRichUserContext(user);

    // 2. Config Dinámica (LM Studio o Cloud)
    const config = await this.settingsModel.findOne({});
    const baseUrl = config?.baseUrl || 'http://localhost:1234/v1';
    const modelName = config?.modelName || 'qwen2.5-7b-instruct-1m';
    const apiKey = config?.apiKey;
    const provider = config?.aiProvider || 'lmstudio';

    // 🛡️ CONFIGURACIÓN DE HEADERS DINÁMICOS
    const headers: any = { 'Content-Type': 'application/json' };
    if (apiKey && provider !== 'lmstudio') {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    this.logger.log(`🔧 Conectando a ${provider.toUpperCase()}: ${baseUrl}`);

    // 3. Preparar tools
    const tools = this.getFunctions().map((fn) => ({
      type: 'function',
      function: {
        name: fn.name,
        description: fn.description,
        parameters: fn.parameters,
      },
    }));

    // 4. Primera llamada
    this.logger.log(`📤 Enviando request a ${provider}... modelo: ${modelName}`);

    const firstResponse = await axios.post(`${baseUrl}/chat/completions`, {
      model: modelName,
      messages: [
        { role: 'system', content: `${this.getSystemPrompt()}\n\n${userContext}` },
        ...conversationHistory.slice(-8),
        { role: 'user', content: message },
      ],
      tools,
      tool_choice: 'auto',
      temperature: provider === 'xai' ? 0 : 0.65, // Grok prefiere 0 para mayor precisión técnica
      max_tokens: 1024,
    }, {
      timeout: 60000,
      headers: headers // 👈 Headers inyectados aquí
    });

    this.logger.log(`📥 Respuesta recibida de ${provider}`);

    const choice = firstResponse.data.choices[0];
    const assistantMessage = choice.message;

    // Caso 1: Respuesta directa
    if (!assistantMessage.tool_calls?.length) {
      return {
        message: assistantMessage.content || 'Entendido, ¿en qué más te ayudo?',
        functionCalled: [],
        functionResult: "",
        timestamp: new Date().toISOString(),
      };
    }

    // Caso 2: Tool calls
    const toolResults: any[] = [];
    this.logger.log(`🔧 Tool calls detectadas: ${assistantMessage.tool_calls.length}`);

    for (const toolCall of assistantMessage.tool_calls) {
      const fnName = toolCall.function.name;
      let args = {};

      try {
        args = JSON.parse(toolCall.function.arguments || '{}');
      } catch (parseError) {
        this.logger.error(`❌ Error parseando args de ${fnName}:`, parseError);
        continue;
      }

      try {
        this.logger.log(`🔧 Ejecutando: ${fnName}`);
        const result = await this.executeFunction(fnName, args, userId);
        this.logger.log(`✅ ${fnName} completado`);

        toolResults.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          name: fnName,
          content: JSON.stringify(result),
        });
      } catch (execError) {
        this.logger.error(`❌ Error ejecutando ${fnName}:`, execError);
        toolResults.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          name: fnName,
          content: JSON.stringify({ error: `Error ejecutando ${fnName}` }),
        });
      }
    }

    // 5. Segunda llamada
    this.logger.log(`📤 Enviando segunda llamada con tool results`);

    const secondResponse = await axios.post(`${baseUrl}/chat/completions`, {
      model: modelName,
      messages: [
        { role: 'system', content: `${this.getSystemPrompt()}\n\n${userContext}` },
        ...conversationHistory.slice(-8),
        { role: 'user', content: message },
        assistantMessage,
        ...toolResults,
      ],
      temperature: 0.7,
      max_tokens: 1024,
    }, {
      timeout: 60000,
      headers: headers // 👈 Headers inyectados aquí también
    });

    const finalContent = secondResponse.data.choices[0].message.content;

    this.logger.log(`✅ Chat completado exitosamente`);

    return {
      message: finalContent || 'Listo, ¿algo más en lo que pueda ayudarte?',
      functionCalled: toolResults.map((t) => t.name),
      functionResult: JSON.stringify(toolResults.map((t) => JSON.parse(t.content))),
      timestamp: new Date().toISOString(),
    };

  } catch (error: any) {
    this.logger.error(`❌ Error en VertexBot (${error.config?.url}):`, error.message);

    let errorMessage = 'Tuve un problema técnico. Intenta de nuevo.';

    if (error.code === 'ECONNREFUSED') {
      errorMessage = 'No puedo conectar con el servidor de IA. Verifica si LM Studio está corriendo o si la URL de la API es correcta.';
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = 'La conexión con la IA tardó demasiado. Intenta de nuevo.';
    } else if (error.response?.status === 401) {
      errorMessage = 'Error de autenticación: La API Key es inválida o expiró.';
    }

    return {
      message: errorMessage,
      functionCalled: [],
      functionResult: JSON.stringify({ error: error.message, details: error.response?.data }),
      timestamp: new Date().toISOString(),
    };
  }
}

  // ============================================
  // TOOLS DISPONIBLES
  // ============================================
  private getFunctions() {
    return [
      {
        name: 'get_current_user_info',
        description: 'Obtiene los datos personales del usuario actual, rol, estadísticas y servicios ofrecidos.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
      {
        name: 'get_available_categories',
        description: 'Lista todas las categorías de servicios disponibles en la plataforma.',
        parameters: {
          type: 'object',
          properties: {
            activeOnly: { type: 'boolean', default: true },
            limit: { type: 'number', default: 20 },
          },
        },
      },
      {
        name: 'search_providers',
        description: 'Busca proveedores reales para una categoría específica. Retorna lista con campo "id" que debe usarse en create_service_request.',
        parameters: {
          type: 'object',
          properties: {
            category: { type: 'string', description: 'Nombre o slug de categoría' },
            keyword: { type: 'string' },
            limit: { type: 'number', default: 5 },
          },
          required: ['category'],
        },
      },
      {
        name: 'get_active_jobs',
        description: 'Obtiene los trabajos activos o recientes del usuario actual.',
        parameters: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['OPEN', 'IN_PROGRESS', 'PENDING_PAYMENT', 'COMPLETED'] },
          },
        },
      },
      {
        name: 'create_service_request',
        description: 'Crea orden de trabajo y notifica al proveedor. CRITICAL: providerId debe ser el "id" de 24 chars de search_providers.',
        parameters: {
          type: 'object',
          properties: {
            providerId: {
              type: 'string',
              description: 'ID ÚNICO del proveedor de search_providers (ej: 507f1f77bcf86cd799439011)'
            },
            category: { type: 'string', description: 'Categoría en mayúsculas' },
            description: { type: 'string', description: 'Qué necesita el cliente' },
            budget: { type: 'number', description: 'Monto en dólares' }
          },
          required: ['providerId', 'category', 'description', 'budget']
        }
      }
    ];
  }

  // ============================================
  // EJECUCIÓN DE TOOLS - CON VALIDACIÓN MEJORADA
  // ============================================
  private async executeFunction(functionName: string, args: any, userId: string) {
    this.logger.log(`Ejecutando función: ${functionName}`);

    switch (functionName) {
      case 'get_current_user_info':
        const user = await this.userService.findOneById(userId);
        if (!user) return { error: 'Usuario no encontrado' };
        return {
          userId: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          location: user.location,
          phone: user.phone,
          bio: user.bio,
          isActive: user.isActive,
          stats: user.stats || {},
          servicesOffered: (user.servicesOffered || []).map((s: any) => ({
            title: s.title,
            categoryId: s.categoryId?.toString(),
          })),
        };

      case 'get_available_categories':
        const activeOnly = args.activeOnly !== false;
        const limit = args.limit || 20;
        const categories = await this.categoryService.findAll(activeOnly);
        return {
          count: categories.length,
          categories: categories.slice(0, limit).map((cat: any) => ({
            name: cat.name,
            slug: cat.slug,
            description: cat.description || 'Sin descripción',
            providersCount: cat.providersCount || 0,
            jobsCount: cat.jobsCount || 0,
          })),
        };

      case 'search_providers':
        return this.searchProviders(args.category, userId, args.keyword, args.limit);

      case 'get_active_jobs':
        const jobStatus = args && args.status ? args.status : undefined;
        return await this.getUserJobs(userId, jobStatus);

      case 'create_service_request':
        const { providerId, category, description, budget } = args;

        // 🛡️ VALIDACIÓN ROBUSTA (NUEVA)
        const validation = await this.validateProvider(providerId, userId);
        if (!validation.valid) {
          this.logger.error(`❌ Validación falló: ${validation.error}`);
          return {
            error: validation.error,
            action: 'VALIDATION_FAILED'
          };
        }

        const provider = validation.provider;
        const client = await this.userService.findOneById(userId);

        if (!client) {
          return { error: 'No se encontró al cliente en el sistema.' };
        }

        this.logger.log(`✅ Creando job: Cliente=${client.name} → Proveedor=${provider?.name}`);

        const jobData = {
          title: `Servicio de ${category} para ${client.name}`,
          description: description || `Solicitud vía VertexBot`,
          price: budget || 0,
          location: client.location || 'Consultar con cliente',
          category: category.toUpperCase(),
          status: 'OPEN',
          client: {
            _id: client._id,
            name: client.name,
            email: client.email
          },
          provider: {
            _id: provider?._id,
            name: provider?.name,
            email: provider?.email
          }
        };

        const newJob = await this.jobService.create(jobData);

        await this.notificationService.create({
          recipientId: new Types.ObjectId(providerId),
          message: `👋 Nueva propuesta: ${jobData.title} por $${budget}`,
          jobId: newJob._id,
          type: 'NEW_JOB'
        });

        this.logger.log(`✅ Job creado: ${newJob._id}`);

        return {
          success: true,
          message: `¡Listo! ${provider?.name} ha sido notificado.`,
          jobId: newJob._id.toString(),
          providerName: provider?.name,
          clientName: client.name,
          action: 'JOB_CREATED'
        };

      default:
        return { error: `Función no implementada: ${functionName}` };
    }
  }

  // ============================================
  // BÚSQUEDA DE PROVEEDORES (SIN CAMBIOS)
  // ============================================
  private async searchProviders(
    categoryInput: string,
    userId: string,
    keyword?: string,
    limit = 5
  ) {
    this.logger.log(`🔍 Buscando proveedores: "${categoryInput}" ${keyword}`);

    let category = null;

    const slugTarget = categoryInput
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();

    category = await this.categoryService.findBySlug(slugTarget);

    if (!category) {
      const searchResults = await this.categoryService.search(categoryInput);
      if (searchResults && searchResults.length > 0) {
        category = searchResults[0];
      }
    }

    if (!category) {
      return {
        found: false,
        message: `No tengo una categoría exacta para "${categoryInput}".`,
        suggestedAction: 'get_available_categories'
      };
    }

    const categoryObjectId = new Types.ObjectId(category._id);

    const providers = await this.userModel.find({
      role: { $in: ['PROVIDER', 'BOTH'] },
      isActive: true,
      servicesOffered: {
        $elemMatch: { categoryId: categoryObjectId }
      },
      _id: { $ne: new Types.ObjectId(userId) },
      stripeConnectedAccountId: { $ne: null }
    })
      .sort({ 'stats.averageRating': -1, 'stats.jobsCompleted': -1 })
      .limit(limit)
      .lean();

    this.logger.log(`✅ Encontrados ${providers.length} proveedores`);

    const mappedProviders = providers.map((p: any) => ({
      id: p._id.toString(),
      name: p.name,
      rating: p.stats?.averageRating?.toFixed(1) || 'Nuevo',
      jobsDone: p.stats?.jobsCompleted || 0,
      location: p.location || 'Global/Remoto',
      services: p.servicesOffered
        ?.filter((s: any) => s.categoryId?.toString() === category._id.toString())
        .map((s: any) => s.title) || [],
    }));

    return {
      found: true,
      category: category.name,
      categorySlug: category.slug,
      count: providers.length,
      providers: mappedProviders,
    };
  }

  // ============================================
  // OBTENER JOBS (SIN CAMBIOS)
  // ============================================
  private async getUserJobs(userId: string, status?: string) {
    try {
      const query: any = {
        $or: [
          { 'client._id': userId },
          { 'provider._id': userId },
        ],
      };

      if (status) {
        query.status = status.toUpperCase();
      }

      const jobs = await this.jobModel
        .find(query)
        .limit(10)
        .select('title status price createdAt client provider')
        .sort({ createdAt: -1 })
        .lean();

      return {
        count: jobs.length,
        jobs: jobs.map((j: any) => ({
          title: j.title,
          status: j.status,
          price: j.price ? `$${j.price}` : 'N/A',
          date: j.createdAt ? new Date(j.createdAt).toLocaleDateString() : 'N/A',
          client: j.client?.name || 'N/A',
          provider: j.provider?.name || 'N/A'
        })),
        context: status ? `Trabajos con estado ${status}` : 'Trabajos recientes'
      };
    } catch (error) {
      return { error: 'No pude recuperar tus trabajos.' };
    }
  }

  // ============================================
  // CONTEXTO DE USUARIO (SIN CAMBIOS)
  // ============================================
  private buildRichUserContext(user: any): string {
    const roleLabel =
      user.role === 'CLIENT' ? 'Cliente' :
        user.role === 'PROVIDER' ? 'Proveedor' :
          user.role === 'BOTH' ? 'Cliente y Proveedor' : 'Usuario';

    const services = user.servicesOffered || [];
    const servicesStr = services.length
      ? services.map((s: any) => s.title || 'Servicio').join(', ')
      : 'Ninguno configurado';

    return `
=== DATOS REALES DEL USUARIO ACTUAL ===
ID del Usuario: ${user._id}
Nombre: ${user.name || 'Sin nombre'}
Rol: ${roleLabel}
Ubicación: ${user.location || 'No especificada'}
Bio: ${user.bio || 'Sin bio'}
Estadísticas:
- Trabajos completados: ${user.stats?.jobsCompleted || 0}
- Rating: ${user.stats?.averageRating?.toFixed(1) || 'Sin calificaciones'}
- Total ganado: $${user.stats?.totalEarned || 0}
Servicios ofrecidos: ${services.length} (${servicesStr})

IMPORTANTE: Este ID (${user._id}) es del USUARIO ACTUAL (${user.name}). 
Cuando busques proveedores y el usuario quiera contratar a alguien, debes usar el ID del PROVEEDOR que encontraste en search_providers, NO este ID.
=== FIN DATOS USUARIO ===`.trim();
  }

  // ============================================
  // SUGERENCIAS (SIN CAMBIOS)
  // ============================================
  async generateSuggestions(userId: string): Promise<string[]> {
    const user = await this.userModel.findById(userId);

    const suggestions = [
      '¿Cómo puedo encontrar un proveedor de limpieza?',
      '¿Cuáles son mis trabajos activos?',
      '¿Cómo funciona el sistema de pagos?'
    ];

    if (user?.role === 'PROVIDER' || user?.role === 'BOTH') {
      suggestions.push('¿Cómo puedo aumentar mis ganancias?');
      suggestions.push('¿Qué debo hacer para activar 2FA?');
    }

    if (user?.role === 'CLIENT' || user?.role === 'BOTH') {
      suggestions.push('¿Qué categorías de servicios están disponibles?');
    }

    return suggestions;
  }
}