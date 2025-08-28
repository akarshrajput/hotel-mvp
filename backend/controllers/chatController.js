const axios = require('axios');
const Ticket = require('../models/Ticket');
const Room = require('../models/Room');

// Mistral AI configuration
const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY || 'your-mistral-api-key-here';

// Function to call Mistral AI
const callMistralAI = async (messages, maxTokens = 300) => {
  try {
    const response = await axios.post(MISTRAL_API_URL, {
      model: 'mistral-tiny', // Free tier model
      messages: messages,
      max_tokens: maxTokens,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${MISTRAL_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Mistral AI API error:', error.response?.data || error.message);
    throw error;
  }
};


// Utility: strip trailing follow-up questions like "Anything else?"
const stripFollowUps = (text = '') => {
  try {
    return (text || '')
      .replace(/\s*(?:anything else\??|need anything else\??|want anything else\??|can i help with anything else\??)\s*$/i, '')
      .trim();
  } catch {
    return text;
  }
};


// Helper: classify a free-text request into multiple ticket categories
// Allowed categories: reception, housekeeping, porter, concierge, service_fb, maintenance
const classifyCategories = async (text) => {
  const allCategories = ['reception', 'housekeeping', 'porter', 'concierge', 'service_fb', 'maintenance'];
  const matchedCategories = [];

  // Enhanced heuristic matching for multiple categories
  const t = (text || '').toLowerCase();
  
  // Housekeeping keywords
  if (/(clean|towel|linen|sheet|housekeep|trash|amenit|bed|pillow|bathroom|soap|shampoo|tissue|toilet paper|extra|replace|fresh)/.test(t)) {
    matchedCategories.push('housekeeping');
  }
  
  // Porter/Bellhop keywords  
  if (/(luggage|baggage|bags|bell ?(boy|hop)|porter|trolley|cart|carry|help with bags|suitcase|move|transport luggage)/.test(t)) {
    matchedCategories.push('porter');
  }
  
  // Maintenance keywords
  if (/(break|broken|leak|ac|heater|hvac|power|door|plumb|fix|repair|not working|maintenance|light|electrical|bulb|switch|outlet|temperature|hot|cold)/.test(t)) {
    matchedCategories.push('maintenance');
  }
  
  // Food & Beverage keywords (with common typos and variations)
  if (/(food|breakfast|dinner|lunch|menu|order|restaurant|bar|drink|beverage|room service|coffe[e]?|tea|water|snack|meal|dining|kitchen|hungry|thirsty|eat|cafe|cappuccino|espresso|latte|juice|soda|beer|wine|cocktail)/.test(t)) {
    matchedCategories.push('service_fb');
  }
  
  // Concierge keywords (transportation, bookings, recommendations)
  if (/(taxi|uber|cab|transport|reservation|book|tour|attraction|recommend|directions|concierge|restaurant|show|ticket|car|vehicle|driver|airport|train|bus|sightseeing|local|city|map)/.test(t)) {
    matchedCategories.push('concierge');
  }
  
  // Reception keywords (keys, billing, check-in/out)
  if (/(check[- ]?in|check[- ]?out|bill|payment|key|card|front desk|reception|invoice|checkout|room key|car key|safe|deposit|account|charge|credit|debit)/.test(t)) {
    matchedCategories.push('reception');
  }

  // If we found categories through heuristics, return them
  if (matchedCategories.length > 0) {
    return matchedCategories;
  }

  // If unclear, ask Mistral for classification
  try {
    const prompt = `Analyze this hotel guest request and identify ALL applicable categories from: reception, housekeeping, porter, concierge, service_fb, maintenance.

Request: "${text}"

Respond with a comma-separated list of category IDs (lowercase, underscore). If multiple categories apply, include all of them. Examples:
- "I need coffee and my room cleaned" -> "service_fb,housekeeping"
- "Can you help with my bags and book a taxi?" -> "porter,concierge"
- "I need car key and coffee" -> "reception,service_fb"
- "The AC is broken" -> "maintenance"
- "Extra towels and room service" -> "housekeeping,service_fb"`;
    
    const out = await callMistralAI([
      { role: 'system', content: 'You are a multi-label classifier for hotel service categories. Output comma-separated category IDs only.' },
      { role: 'user', content: prompt }
    ], 20);
    
    const categories = (out || '').trim().toLowerCase().split(',').map(c => c.trim()).filter(c => allCategories.includes(c));
    if (categories.length > 0) return categories;
  } catch (e) {
    // ignore and fall through to default
  }

  return ['reception'];
};

// Backward compatibility: single category classification
const classifyCategory = async (text) => {
  const categories = await classifyCategories(text);
  return categories[0] || 'reception';
};

// @desc    Handle AI chat for guests
// @route   POST /api/chat/ai
// @access  Public
exports.chatWithAI = async (req, res) => {
  try {
    const { message, guestInfo, conversationHistory = [] } = req.body;

    if (!message || !guestInfo) {
      return res.status(400).json({
        success: false,
        message: 'Message and guest info are required'
      });
    }

    // System prompt for hotel AI assistant - short, direct, no follow-up questions
    const systemPrompt = `You are a hotel AI assistant for ${guestInfo.guestName} in room ${guestInfo.roomNumber}.

Rules:
- Keep responses short and direct: one concise line (max 10–15 words).
- Sound like the staff member personally handling it: warm, confident, actionable.
- Do NOT add follow-up questions like "Anything else?", "Need anything else?", etc.

Examples:
- Guest: "Need coffee" → "Sure, I'll bring your coffee in a few minutes."
- Guest: "Room dirty" → "I'll come clean the room shortly."
- Guest: "AC broken" → "I'll send maintenance to fix it now."
- Guest: "Need taxi" → "I'll arrange a taxi right away."
- Guest: "Where's my car?" → "I'll check and update you in a moment."`;

    // Prepare conversation for Mistral AI
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      { role: 'user', content: message }
    ];

    // Call Mistral AI API with enhanced logic
    let aiResponse;
    let shouldCreateTicket = false;
    let urgencyLevel = 'medium';

    try {
      aiResponse = await callMistralAI(messages, 50);

      // Enhanced logic to determine if ticket should be created
      const serviceKeywords = [
        'room service', 'housekeeping', 'maintenance', 'clean', 'towels', 'pillows', 
        'temperature', 'hot water', 'cold', 'repair', 'fix', 'help', 'staff', 
        'manager', 'complaint', 'problem', 'issue', 'request'
      ];
      
      const needsService = serviceKeywords.some(keyword => 
        message.toLowerCase().includes(keyword) || 
        aiResponse.toLowerCase().includes('service request')
      );

      if (needsService) {
        shouldCreateTicket = true;
      }

      // If AI response suggests creating a ticket, set the flag
      if (aiResponse.toLowerCase().includes('service request') || 
          aiResponse.toLowerCase().includes('staff') ||
          aiResponse.toLowerCase().includes('help you with that')) {
        shouldCreateTicket = true;
      }

    } catch (mistralError) {
      console.error('Mistral AI API error:', mistralError);
      
      // Personal service fallback responses
      const fallbackResponses = [
        `I'll take care of that for you right away!`,
        `Sure, give me a few minutes to help.`,
        `I'll handle that for you shortly.`
      ];
      
      aiResponse = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
      shouldCreateTicket = true;
    }

    // Final sanitize to ensure no trailing follow-up prompts slip through
    aiResponse = stripFollowUps(aiResponse);

    res.json({
      success: true,
      message: aiResponse,
      shouldCreateTicket,
      timestamp: new Date(),
      conversationId: `${guestInfo.roomNumber}-${Date.now()}`
    });

  } catch (error) {
    console.error('Chat AI error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process chat message'
    });
  }
};

// Helper function to generate meaningful ticket subject
const generateTicketSubject = async (message) => {
  try {
    const prompt = `Generate a descriptive 4-5 word subject line for this hotel service request. Include specific details like quantities and items. Examples:
- "I need 2 coffee" -> "2 Coffees Request"
- "AC not working" -> "AC Repair Needed"
- "Need 3 extra towels" -> "3 Extra Towels Request"
- "Room service breakfast" -> "Breakfast Room Service"
- "Help with 2 bags" -> "2 Bags Assistance"
- "Book taxi to airport" -> "Airport Taxi Booking"
- "Room cleaning needed" -> "Room Cleaning Request"
- "WiFi password please" -> "WiFi Password Request"

Request: "${message}"

Respond with ONLY the subject line (4-5 words, title case, include quantities/specifics):`;
    
    const subject = await callMistralAI([
      { role: 'system', content: 'You generate concise, professional hotel service request subjects.' },
      { role: 'user', content: prompt }
    ], 10);
    
    const cleanSubject = (subject || '').trim().replace(/["']/g, '');
    return cleanSubject.length > 0 && cleanSubject.length <= 50 ? cleanSubject : 'Service Request';
  } catch (e) {
    return 'Service Request';
  }
};

// @desc    Create ticket from guest chat
// @route   POST /api/tickets/guest
// @access  Public
exports.createGuestTicket = async (req, res) => {
  try {
    const { roomNumber, guestInfo, initialMessage, conversationHistory = [] } = req.body;

    if (!roomNumber || !guestInfo || !initialMessage) {
      return res.status(400).json({
        success: false,
        message: 'Room number, guest info, and initial message are required'
      });
    }

    // Find the room to get the manager
    const room = await Room.findOne({ number: roomNumber });
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Format conversation history for professional display
    const formattedConversation = conversationHistory.map(msg => ({
      content: msg.content,
      sender: msg.role === 'user' ? 'guest' : 'ai_assistant',
      senderName: msg.role === 'user' ? guestInfo.name : 'AI Assistant',
      timestamp: msg.timestamp || new Date().toISOString()
    }));

    // Create summary for the ticket
    const conversationSummary = `Guest Chat Summary:
${conversationHistory.map(msg => 
  `${msg.role === 'user' ? guestInfo.name : 'AI Assistant'}: ${msg.content}`
).join('\n')}

Current Request: ${initialMessage}`;

    // Determine categories using AI + heuristics
    let categories = ['reception'];
    let category = 'reception';
    try {
      categories = await classifyCategories(initialMessage);
      category = categories[0] || 'reception';
      console.log('🔍 Classification Debug:', {
        initialMessage,
        detectedCategories: categories,
        primaryCategory: category
      });
    } catch (error) {
      console.error('Classification error:', error);
      /* keep default */
    }

    // Generate meaningful subject
    const subject = await generateTicketSubject(initialMessage);

    // Create the ticket with conversation history and multiple categories
    const ticket = await Ticket.create({
      room: room._id,
      roomNumber: roomNumber,
      categories,
      category, // Keep for backward compatibility
      guestInfo: {
        name: guestInfo.name,
        email: guestInfo.email || '',
        phone: guestInfo.phone || ''
      },
      status: 'raised',
      manager: room.manager,
      subject: subject,
      messages: [
        ...formattedConversation,
        {
          content: `🎫 Service Request Created\n\n${initialMessage}`,
          sender: 'system',
          senderName: 'System',
          timestamp: new Date().toISOString()
        }
      ]
    });

    // Populate the ticket with room details
    await ticket.populate('room');

    // Emit real-time notification to managers
    if (req.app && req.app.get('io')) {
      const io = req.app.get('io');
      io.emit('newTicket', {
        ticket,
        notification: {
          title: 'New Service Request',
          message: `${guestInfo.name} from Room ${roomNumber} needs assistance`,
          timestamp: new Date().toISOString()
        }
      });
    }

    res.status(201).json({
      success: true,
      message: 'Service request created successfully',
      data: ticket
    });

  } catch (error) {
    console.error('Create guest ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create service request'
    });
  }
};

// @desc    Get AI suggestions for manager responses
// @route   POST /api/chat/manager-assist
// @access  Private/Manager
exports.managerAIAssist = async (req, res) => {
  try {
    const { ticketId, conversationHistory, requestType } = req.body;

    if (!ticketId || !conversationHistory) {
      return res.status(400).json({
        success: false,
        message: 'Ticket ID and conversation history are required'
      });
    }

    const ticket = await Ticket.findById(ticketId).populate('room');
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Create system prompt for manager assistance
    const systemPrompt = `You are an AI assistant helping a hotel manager respond to guest requests. 

Guest: ${ticket.guestInfo.name}
Room: ${ticket.roomNumber}
Request Type: ${requestType || 'General'}

Based on the conversation history, suggest a professional and helpful response that:
1. Acknowledges the guest's request
2. Provides a solution or next steps
3. Sets appropriate expectations for timing
4. Maintains a friendly, professional tone

Keep the response concise and actionable. Focus on customer service excellence.`;

    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.map(msg => ({
          role: msg.sender === 'guest' ? 'user' : 'assistant',
          content: msg.content
        }))
      ];

      const suggestion = await callMistralAI(messages, 200);

      res.json({
        success: true,
        suggestion,
        timestamp: new Date()
      });

    } catch (mistralError) {
      console.error('Mistral AI API error:', mistralError);
      
      // Fallback suggestion
      const fallbackSuggestion = `Thank you for bringing this to our attention, ${ticket.guestInfo.name}. We understand your concern and will address this promptly within 30 minutes.`;
      
      res.json({
        success: true,
        suggestion: fallbackSuggestion,
        timestamp: new Date()
      });
    }

  } catch (error) {
    console.error('Manager AI assist error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get AI assistance'
    });
  }
};
