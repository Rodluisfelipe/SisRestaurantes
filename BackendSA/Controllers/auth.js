const SuperAdmin = require('../Models/SuperAdmin');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
require('dotenv').config();

// Configuración de JWT
const JWT_SECRET = process.env.JWT_SECRET || 'superadmin-secret-key';
const JWT_EXPIRES_IN = '24h'; // Token válido por 24 horas

console.log('Configurando Nodemailer con:', {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS ? '[PRESENTE]' : '[NO PRESENTE]'
});

// Configuración del servicio de email para Gmail
const emailTransporter = nodemailer.createTransport({
  service: 'gmail',
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // true para 465, false para otros puertos
  auth: {
    user: process.env.SMTP_USER || 'pipe95141007@gmail.com',
    pass: process.env.SMTP_PASS || 'qwkm zllj dzmh kbfz'
  },
  debug: true, // Mostrar logs de depuración
  logger: true // Registrar actividad
});

// Verificar la configuración del transportador
emailTransporter.verify(function(error, success) {
  if (error) {
    console.error('Error en la configuración de Nodemailer:', error);
  } else {
    console.log('Servidor SMTP listo para enviar mensajes');
  }
});

// Función para enviar correo electrónico
const sendEmail = async (options) => {
  console.log('Intentando enviar email a:', options.email);
  
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'Restaurantes System <pipe95141007@gmail.com>',
    to: options.email,
    subject: options.subject,
    text: options.message
  };

  try {
    const info = await emailTransporter.sendMail(mailOptions);
    console.log('Email enviado:', info.response);
    console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
    return info;
  } catch (error) {
    console.error('Error al enviar email:', error);
    throw error;
  }
};

// Login de SuperAdmin
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validar campos requeridos
    if (!email || !password) {
      return res.status(400).json({ message: 'Email y contraseña son requeridos' });
    }

    // Buscar SuperAdmin por email
    const superAdmin = await SuperAdmin.findOne({ email });
    if (!superAdmin) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    // Verificar contraseña
    const isMatch = await superAdmin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    // Generar token JWT
    const token = jwt.sign({ id: superAdmin._id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    // Respuesta exitosa
    res.json({
      success: true,
      token,
      superAdmin: {
        id: superAdmin._id,
        email: superAdmin.email
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

// Cambio de contraseña
exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const superAdminId = req.superAdmin.id;

    // Validar campos requeridos
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: 'Contraseña antigua y nueva son requeridas' });
    }

    // Buscar SuperAdmin por ID
    const superAdmin = await SuperAdmin.findById(superAdminId);
    if (!superAdmin) {
      return res.status(404).json({ message: 'SuperAdmin no encontrado' });
    }

    // Verificar contraseña antigua
    const isMatch = await superAdmin.comparePassword(oldPassword);
    if (!isMatch) {
      return res.status(401).json({ message: 'Contraseña antigua incorrecta' });
    }

    // Actualizar contraseña
    superAdmin.password = newPassword;
    await superAdmin.save();

    res.json({ message: 'Contraseña actualizada exitosamente' });
  } catch (error) {
    console.error('Error en cambio de contraseña:', error);
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

// Solicitud de recuperación de contraseña
exports.forgotPassword = async (req, res) => {
  try {
    console.log('Solicitud de recuperación de contraseña recibida:', req.body);
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'El email es requerido' });
    }

    // Generar token aleatorio
    const resetToken = crypto.randomBytes(20).toString('hex');
    console.log('Token generado:', resetToken);
    
    // Buscar SuperAdmin por email
    const superAdmin = await SuperAdmin.findOne({ email });
    console.log('SuperAdmin encontrado:', superAdmin ? 'Sí' : 'No');
    
    // Si no existe, enviamos respuesta exitosa de todas formas por seguridad
    if (!superAdmin) {
      return res.json({ 
        message: 'Si el email existe, recibirá instrucciones para restablecer su contraseña',
        success: true
      });
    }

    // Guardar token y expiración (1 hora)
    superAdmin.resetPasswordToken = resetToken;
    superAdmin.resetPasswordExpires = Date.now() + 3600000; // 1 hora en milisegundos
    await superAdmin.save();
    console.log('Token guardado en la base de datos');

    // URL para restablecer contraseña
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5174'}/reset-password/${resetToken}`;
    console.log('URL de restablecimiento:', resetUrl);

    try {
      // Enviar email de recuperación
      await sendEmail({
        email: superAdmin.email,
        subject: 'Restaurantes System - Recuperación de contraseña',
        message: `Has solicitado restablecer tu contraseña.\n\n
                 Por favor, haz clic en el siguiente enlace o pégalo en tu navegador para completar el proceso:\n\n
                 ${resetUrl}\n\n
                 Este enlace expirará en 1 hora.\n\n
                 Si no solicitaste esto, por favor ignora este correo y tu contraseña permanecerá sin cambios.`
      });

      console.log('Email enviado exitosamente a:', superAdmin.email);

      res.json({ 
        message: 'Se ha enviado un correo con instrucciones para restablecer tu contraseña',
        success: true
      });
    } catch (emailError) {
      console.error('Error detallado al enviar el correo:', emailError);
      
      // Si hay un error al enviar el correo, no eliminamos el token
      // para permitir que el usuario pueda intentarlo de nuevo más tarde
      
      return res.status(500).json({ 
        message: 'No se pudo enviar el correo electrónico. Por favor, intenta de nuevo más tarde.',
        error: emailError.message,
        success: false,
        // Proporcionar el token en desarrollo para pruebas
        dev_info: process.env.NODE_ENV === 'development' ? {
          resetToken,
          resetUrl
        } : undefined
      });
    }
  } catch (error) {
    console.error('Error en recuperación de contraseña:', error);
    res.status(500).json({ 
      message: 'Error en el servidor', 
      error: error.message,
      success: false
    });
  }
};

// Restablecer contraseña con token
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token y nueva contraseña son requeridos' });
    }

    // Buscar SuperAdmin con token válido
    const superAdmin = await SuperAdmin.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!superAdmin) {
      return res.status(400).json({ message: 'Token inválido o expirado' });
    }

    // Actualizar contraseña y limpiar token
    superAdmin.password = newPassword;
    superAdmin.resetPasswordToken = undefined;
    superAdmin.resetPasswordExpires = undefined;
    await superAdmin.save();

    res.json({ message: 'Contraseña actualizada exitosamente' });
  } catch (error) {
    console.error('Error en restablecimiento de contraseña:', error);
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
}; 