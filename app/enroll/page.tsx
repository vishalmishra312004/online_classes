"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/contexts/auth-context"
import { CheckCircle, CreditCard, Shield, Clock, Users, Award, Loader2 } from "lucide-react"
import { Navigation } from "@/components/navigation"

const courseFeatures = [
  "40+ hours of premium video content",
  "15 hands-on projects and exercises",
  "Lifetime access to course materials",
  "Certificate of completion",
  "Direct instructor support",
  "Access to private Discord community",
  "Regular content updates",
  "30-day money-back guarantee",
]

// Removed manual payment inputs. Razorpay modal will collect payment details.

export default function EnrollPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [coursePrice, setCoursePrice] = useState(29900) // Default price in paise
  const [courseId, setCourseId] = useState("") // Store actual course ID
  const [courseInfo, setCourseInfo] = useState({
    title: "Modern Web Development",
    price: 299,
    originalPrice: 599,
    discount: "50% OFF"
  })

  const fetchCoursePrice = async () => {
    try {
      // For now, we'll fetch the first active course
      // In a real application, you might want to pass courseId as a parameter
      const response = await fetch(`/api/courses?t=${Date.now()}`)
      if (response.ok) {
        const data = await response.json()
        if (data.courses && data.courses.length > 0) {
          const course = data.courses[0] // Get the first course
          setCourseId(course.id) // Store the actual course ID
          setCoursePrice(course.price)
          setCourseInfo({
            title: course.title,
            price: course.price / 100, // Convert from paise to rupees
            originalPrice: course.originalPrice / 100,
            discount: course.discount
          })
          console.log('Course price updated:', {
            courseId: course.id,
            price: course.price,
            displayPrice: course.price / 100
          })
        }
      }
    } catch (error) {
      console.error('Error fetching course price:', error)
      // Keep default values if fetch fails
    }
  }

  useEffect(() => {
    setMounted(true)
    fetchCoursePrice()
    // Load Razorpay Checkout script
    const script = document.createElement("script")
    script.src = "https://checkout.razorpay.com/v1/checkout.js"
    script.async = true
    document.body.appendChild(script)
    if (!user) {
      router.push("/auth")
    } else if (user.enrolledCourse) {
      router.push("/dashboard")
    }
  }, [user, router])

  if (!mounted || !user) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  // No input handling needed; Razorpay collects card details securely.

  const handleEnrollment = async () => {
    if (!user) return
    try {
      setProcessing(true)

      // Refresh course price before payment to ensure we have the latest price
      await fetchCoursePrice()

      console.log('Creating payment order with:', {
        courseId,
        coursePrice,
        displayPrice: coursePrice / 100
      })

      // Create order on the server (amount in paise)
      const orderRes = await fetch("/api/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          amount: coursePrice, 
          currency: "INR", 
          receipt: `rcpt_${Date.now()}`,
          courseId: courseId || "default" // Use actual course ID
        }),
      })
      if (!orderRes.ok) throw new Error("Failed to create order")
      const order = await orderRes.json()

      const key = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
      if (!key) {
        throw new Error("Missing Razorpay public key")
      }

      const options: any = {
        key,
        amount: order.amount,
        currency: order.currency,
        name: "Placement Pulse",
        description: "Course Enrollment",
        order_id: order.id,
        prefill: {
          name: user.name || "",
          email: user.email,
        },
        theme: { color: "#4f46e5" },
        handler: async function (response: any) {
          try {
            // Server-side verify and enroll
            const enrollRes = await fetch("/api/enroll", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                user: { id: user.id, email: user.email, name: user.name },
                verification: {
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                },
              }),
            })
            const data = await enrollRes.json()
            if (!enrollRes.ok || !data.success) throw new Error(data.error || "Verification failed")

            const updatedUser = { ...user, enrolledCourse: true, progress: 0 }
            localStorage.setItem("user", JSON.stringify(updatedUser))
            setProcessing(false)
            router.push("/dashboard?enrolled=true")
          } catch (err) {
            setProcessing(false)
            // no enrollment on failure
            console.error(err)
          }
        },
        modal: {
          ondismiss: function () {
            setProcessing(false)
          },
        },
      }

      // @ts-ignore - Razorpay injected by script
      const rzp = new (window as any).Razorpay(options)
      rzp.open()
    } catch (e) {
      console.error(e)
      setProcessing(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="container mx-auto px-4 py-8 pt-24">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4">Complete Your Enrollment</h1>
            <p className="text-xl text-muted-foreground">Join thousands of students learning modern web development</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Course Summary */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl">Modern Web Development Course</CardTitle>
                  <CardDescription>Master React, Next.js, and TypeScript with hands-on projects</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-lg">
                      <span>Course Price</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">₹{courseInfo.price}</span>
                        {courseInfo.originalPrice && courseInfo.originalPrice > courseInfo.price && (
                          <span className="text-sm text-gray-500 line-through">₹{courseInfo.originalPrice}</span>
                        )}
                        {courseInfo.discount && (
                          <span className="text-sm bg-red-100 text-red-800 px-2 py-1 rounded">
                            {courseInfo.discount}
                          </span>
                        )}
                      </div>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <Clock className="h-6 w-6 mx-auto mb-2 text-accent" />
                        <div className="text-sm font-medium">40+ Hours</div>
                        <div className="text-xs text-muted-foreground">Content</div>
                      </div>
                      <div>
                        <Users className="h-6 w-6 mx-auto mb-2 text-accent" />
                        <div className="text-sm font-medium">2,500+</div>
                        <div className="text-xs text-muted-foreground">Students</div>
                      </div>
                      <div>
                        <Award className="h-6 w-6 mx-auto mb-2 text-accent" />
                        <div className="text-sm font-medium">Certificate</div>
                        <div className="text-xs text-muted-foreground">Included</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>What's Included</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {courseFeatures.map((feature, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-accent/5 border-accent/20">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <Shield className="h-6 w-6 text-accent" />
                    <span className="font-semibold">30-Day Money-Back Guarantee</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Not satisfied with the course? Get a full refund within 30 days, no questions asked.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Payment Summary and proceed */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Order Summary</CardTitle>
                  <CardDescription>Secure checkout via Razorpay</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span>Course Price</span>
                      <span>₹{courseInfo.price}.00</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Tax</span>
                      <span>₹0.00</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between text-lg font-bold">
                      <span>Total</span>
                      <span>₹{courseInfo.price}.00</span>
                    </div>
                  </div>

                  <Button onClick={handleEnrollment} disabled={processing} className="w-full mt-2" size="lg">
                    {processing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Redirecting to Razorpay...
                      </>
                    ) : (
                      <>
                        <CreditCard className="mr-2 h-4 w-4" />
                        Proceed to Payment
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-muted-foreground text-center mt-2">
                    You will be redirected to Razorpay to securely complete your payment.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
