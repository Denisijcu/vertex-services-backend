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
  ) { }

  // System Prompt mejorado con instrucciones claras sobre Provider ID
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
8. SI EL USUARIO PIDE RECOMENDACIÓN DE PROVEEDORES, HAZLO INMEDIATAMENTE: NO  MIENTAS SI NO HAY PROVEEDORES DISPONIBLES. SI NO HAY PROVEEDORES, DILE QUE ESTÁS EXPANDIENDO LA RED Y OFRECE CREAR LA SOLICITUD DIRECTAMENTE. NO DIGAS "NO HAY PROVEEDORES". DILE QUE ESTÁS TRABAJANDO EN CONSEGUIRLOS Y OFRECE CREAR LA SOLICITUD DE SERVICIO DIRECTAMENTE.
9. SINO SABES NADA O NO TIENES DATOS DE LA BASE DE DATOS. NO INVENTES RESPUESTAS. DILE AL USUARIO QUE TODA LA INFORMACION LA PUEDE ENCONTRAR EN LA SECCION DE MARKETPLACE DE LA PLATAFORMA DONDE HAY MUCHOS PROFESIONALES CON SUS SERVICIOS, PRECIOS Y RESEÑAS. ORIENTA AL USUARIO A USAR ESA SECCIÓN PARA ELEGIR EL PROVEEDOR QUE MÁS LE GUSTE. SI EL USUARIO PIDE RECOMENDACIÓN, DILE QUE NO PUEDES RECOMENDARLE UN PROVEEDOR ESPECÍFICO, PERO QUE EN EL MARKETPLACE HAY MUCHOS PROFESIONALES CON SUS SERVICIOS, PRECIOS Y RESEÑAS PARA QUE PUEDA ELEGIR EL QUE MÁS LE GUSTE.

`;
  }

  // ============================================
  // CHAT PRINCIPAL - AGENTE CON TOOL CALLING
  // ============================================
  async chat(userId: string, message: string, conversationHistory: any[] = []) {
    try {
      // 1. Cargar usuario real
      const user = await this.userService.findOneById(userId);
      if (!user) {
        return { message: 'No encontré tu cuenta. Intenta iniciar sesión nuevamente.', error: true };
      }

      const userContext = this.buildRichUserContext(user);

      // 2. Config LM Studio
      const config = await this.settingsModel.findOne({});
      const baseUrl = config?.baseUrl || 'http://localhost:1234/v1';
      const modelName = config?.modelName || 'qwen2.5-7b-instruct-1m';

      // 3. Preparar tools
      const tools = this.getFunctions().map((fn) => ({
        type: 'function',
        function: {
          name: fn.name,
          description: fn.description,
          parameters: fn.parameters,
        },
      }));

      // 4. Primera llamada al LLM
      const firstResponse = await axios.post(`${baseUrl}/chat/completions`, {
        model: modelName,
        messages: [
          { role: 'system', content: `${this.getSystemPrompt()}\n\n${userContext}` },
          ...conversationHistory.slice(-8),
          { role: 'user', content: message },
        ],
        tools,
        tool_choice: 'auto',
        temperature: 0.65,
        max_tokens: 1024,
      }, {
        timeout: 120000 // 2 minutos para darle tiempo
      });

      const choice = firstResponse.data.choices[0];
      const assistantMessage = choice.message;

      // Caso 1: Respuesta directa (sin tool)
      if (!assistantMessage.tool_calls?.length) {
        return {
          message: assistantMessage.content || 'Entendido, ¿en qué más te ayudo?',
          functionCalled: [], // 👈 Cambia null por un array vacío
          functionResult: "",  // 👈 Añade esto para cumplir el Schema
          timestamp: new Date().toISOString(), // 👈 ¡Faltaba esto!
        };
      }

      // Caso 2: Hay tool calls → ejecutarlas
      const toolResults: any[] = [];

      console.log('🔧 Tool calls detectadas:', JSON.stringify(assistantMessage.tool_calls, null, 2));

      for (const toolCall of assistantMessage.tool_calls) {
        const fnName = toolCall.function.name;
        let args = {};
        try {
          args = JSON.parse(toolCall.function.arguments || '{}');
        } catch (parseError) {
          console.error(`❌ ERROR PARSEANDO ARGUMENTOS DE ${fnName}:`, parseError);
          continue;
        }

        try {
          const result = await this.executeFunction(fnName, args, userId);
          toolResults.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            name: fnName,
            content: JSON.stringify(result),
          });
        } catch (execError) {
          console.error(`❌ ERROR EJECUTANDO LA FUNCIÓN ${fnName}:`, execError);
          toolResults.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            name: fnName,
            content: JSON.stringify({ error: `Error ejecutando ${fnName}: ` }),
          });
        }
      }

      // 5. Segunda llamada al LLM con resultados de tools
      console.log('📤 Enviando segunda llamada con tool results:', toolResults);

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
        timeout: 120000
      });

      const finalContent = secondResponse.data.choices[0].message.content;

      console.log('📥 Respuesta final del LLM:', finalContent);

      return {
        message: finalContent || 'Listo, ¿algo más en lo que pueda ayudarte?',
        functionCalled: toolResults.map((t) => t.name),
        functionResult: JSON.stringify(toolResults.map((t) => JSON.parse(t.content))), // 👈 Conviértelo a string
        timestamp: new Date().toISOString(), // 👈 ¡Obligatorio!
      };

    } catch (error) {
      this.logger.error('❌ Error en VertexBot:', error);
      return {
        message: 'Tuve un problema conectándome con mi cerebro. Intenta de nuevo.',
        functionCalled: [],
        functionResult: "",
        timestamp: new Date().toISOString(), // 👈 Esto evitará el error de 'getType'
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
        description: 'Obtiene los datos personales del usuario actual, rol, estadísticas y servicios ofrecidos. Úsala cuando necesites hablar del perfil, ganancias, trabajos o servicios del usuario.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
      {
        name: 'get_available_categories',
        description: 'Lista todas las categorías de servicios disponibles en la plataforma (limpieza, mantenimiento, etc.). Úsala cuando el usuario pregunte qué servicios hay o no estés seguro de la categoría.',
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
        description: 'Busca proveedores reales para una categoría específica. Retorna una lista de proveedores con su ID único. Usa el nombre o slug exacto de categoría.',
        parameters: {
          type: 'object',
          properties: {
            category: { type: 'string', description: 'Nombre o slug de categoría (ej: "Limpieza", "Maintenance & Repairs")' },
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
        description: 'Crea una orden de trabajo formal y notifica al proveedor. CRITICAL: El providerId DEBE ser el ID hexadecimal de 24 caracteres que obtuviste de search_providers. NUNCA uses el ID del usuario actual.',
        parameters: {
          type: 'object',
          properties: {
            providerId: {
              type: 'string',
              description: 'ID ÚNICO del proveedor obtenido de search_providers (ej: 507f1f77bcf86cd799439011). NUNCA uses el nombre del proveedor ni el ID del usuario actual aquí.'
            },
            category: {
              type: 'string',
              description: 'Categoría oficial del servicio (ej: MAINTENANCE, CLEANING, TECH)'
            },
            description: {
              type: 'string',
              description: 'Breve descripción de lo que el cliente necesita.'
            },
            budget: {
              type: 'number',
              description: 'Monto total acordado en dólares.'
            }
          },
          required: ['providerId', 'category', 'description', 'budget']
        }
      }
    ];
  }

  // ============================================
  // EJECUCIÓN DE TOOLS
  // ============================================
  private async executeFunction(functionName: string, args: any, userId: string) {
    this.logger.log(`Ejecutando función: ${functionName} con args:`, args);

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
        return this.searchProviders(args.category, userId, args.keyword,);

      case 'get_active_jobs':
        const jobStatus = args && args.status ? args.status : undefined;
        return await this.getUserJobs(userId, jobStatus);

      case 'create_service_request':
        const { providerId, category, description, budget } = args;

        // 🛡️ VALIDACIÓN CRÍTICA: Que no se contrate a sí mismo
        if (providerId === userId || providerId === userId.toString()) {
          this.logger.error(`🚨 INTENTO DE AUTO-CONTRATACIÓN: userId=${userId}, providerId=${providerId}`);
          return {
            error: 'ERROR INTERNO: Detecté que intentas contratarte a ti mismo. Necesito que vuelvas a buscar al proveedor correcto usando search_providers.',
            action: 'RESTART_SEARCH'
          };
        }

        // 1. Buscamos los datos reales del proveedor y cliente
        const [providerUser, clientUser] = await Promise.all([
          this.userModel.findById(providerId),
          this.userService.findOneById(userId)
        ]);

        if (!providerUser) {
          this.logger.error(`❌ No se encontró proveedor con ID: ${providerId}`);
          return { error: `No se encontró al proveedor con ID ${providerId}. Verifica que el ID sea correcto.` };
        }

        if (!clientUser) {
          this.logger.error(`❌ No se encontró cliente con ID: ${userId}`);
          return { error: 'No se encontró al cliente en el sistema.' };
        }

        // 2. Log para debugging
        this.logger.log(`✅ Creando job: Cliente=${clientUser.name} (${userId}) -> Proveedor=${providerUser.name} (${providerId})`);

        // 3. Construimos el objeto EXACTO que pide tu Schema
        const jobData = {
          title: `Servicio de ${category} para ${clientUser.name}`,
          description: description || `Solicitud de servicio vía VertexBot`,
          price: budget || 0,
          location: clientUser.location || 'Consultar con cliente',
          category: category.toUpperCase(), // Aseguramos que sea uppercase
          status: 'OPEN',
          client: {
            _id: clientUser._id,
            name: clientUser.name,
            email: clientUser.email
          },
          provider: {
            _id: providerUser._id,
            name: providerUser.name,
            email: providerUser.email
          }
        };

        // 4. Crear el Job
        const newJob = await this.jobService.create(jobData);

        // 5. Notificar al proveedor real
        await this.notificationService.create({
          recipientId: providerId,
          message: `👋 Nueva propuesta: ${jobData.title} por $${budget}`,
          jobId: newJob._id,
          type: 'NEW_JOB'
        });

        this.logger.log(`✅ Job creado exitosamente: ${newJob._id}`);

        return {
          success: true,
          message: `¡Propuesta creada! He notificado a ${providerUser.name}. Ya puedes ver el job en tu lista.`,
          jobId: newJob._id.toString(),
          providerName: providerUser.name,
          clientName: clientUser.name,
          action: 'JOB_CREATED'
        };

      default:
        return { error: `Función no implementada: ${functionName}` };
    }
  }

  // ============================================
  // BÚSQUEDA DE PROVEEDORES
  // ============================================
  private async searchProviders(
    categoryInput: string,
    userId: string,
    // keyword?: string,
    limit = 5
  ) {
    this.logger.log(`🔍 [searchProviders] Buscando para: "${categoryInput}"`);

    let category = null;

    // 1. Intentar por SLUG
    const slugTarget = categoryInput
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();

    category = await this.categoryService.findBySlug(slugTarget);

    // 2. Si no lo encuentra por slug, buscar por nombre/keywords
    if (!category) {
      const searchResults = await this.categoryService.search(categoryInput);
      if (searchResults && searchResults.length > 0) {
        category = searchResults[0];
      }
    }

    // 3. Si sigue sin aparecer, error amable
    if (!category) {
      return {
        found: false,
        message: `Actualmente no tengo una categoría exacta para "${categoryInput}".`,
        suggestedAction: 'get_available_categories'
      };
    }

    const categoryObjectId = new Types.ObjectId(category._id);

    // 4. Buscar proveedores
    const providers = await this.userModel.find({
      role: { $in: ['PROVIDER', 'BOTH'] },
      isActive: true,
      servicesOffered: {
        $elemMatch: { categoryId: categoryObjectId }
      },
      _id: { $ne: new Types.ObjectId(userId) }, // No incluir al usuario actual
      stripeConnectedAccountId: { $ne: null } // Solo proveedores con Stripe
    })
      .sort({ 'stats.averageRating': -1, 'stats.jobsCompleted': -1 })
      .limit(limit)
      .lean();

    this.logger.log(`✅ Encontrados ${providers.length} proveedores para ${category.name}`);

    const mappedProviders = providers.map((p: any) => ({
      id: p._id.toString(), // 👈 CRÍTICO: Este es el ID que la IA debe usar
      name: p.name,
      rating: p.stats?.averageRating?.toFixed(1) || 'Nuevo',
      jobsDone: p.stats?.jobsCompleted || 0,
      location: p.location || 'Global/Remoto',
      services: p.servicesOffered
        ?.filter((s: any) => s.categoryId?.toString() === category._id.toString())
        .map((s: any) => s.title) || [],
    }));

    // Log detallado para debugging
    this.logger.log(`📋 Proveedores mapeados:`, JSON.stringify(mappedProviders, null, 2));

    return {
      found: true,
      category: category.name,
      categorySlug: category.slug,
      count: providers.length,
      lastSearchProviderId: mappedProviders[0]?.id, // Hint adicional para la IA
      providers: mappedProviders,
    };
  }

  // ============================================
  // OBTENER JOBS DEL USUARIO
  // ============================================
  private async getUserJobs(userId: string, status?: string) {
    try {
      const query: any = {
        $or: [
          { 'client._id': userId },
          { 'provider._id': userId },
          { 'userId': userId }
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
          price: j.price ? `$${j.price}` : 'Precio no definido',
          date: j.createdAt ? new Date(j.createdAt).toLocaleDateString() : 'N/A',
          client: j.client?.name || 'N/A',
          provider: j.provider?.name || 'N/A'
        })),
        context: status ? `Mostrando trabajos con estado ${status}` : 'Mostrando trabajos recientes'
      };
    } catch (error) {
      return { error: 'No pude recuperar tus trabajos en este momento.' };
    }
  }

  // ============================================
  // CONTEXTO ENRIQUECIDO DEL USUARIO
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
  // GENERAR SUGERENCIAS DE CONVERSACIÓN
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